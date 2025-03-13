import pkg from 'square';
const { Client, Environment } = pkg;
import type { SquareConfig, CheckInResult } from '~/types';
import { formatCustomerData } from './formatters.server';
import { validateSubscription, validateCashPayment } from './membership.server';
import { getEnv } from './env.server';
import { triggerWebhook } from './webhook.server';
import { getSystemStatus } from './system.server';

let squareClient: Client | null = null;
let lastConnectionAttempt = 0;
const CONNECTION_RETRY_INTERVAL = 60000; // 1 minute

export function initSquareClient(): Client | null {
  const env = getEnv();

  // If no access token is provided, return null instead of throwing
  if (!env.SQUARE_ACCESS_TOKEN) {
    console.warn('Square access token not provided');
    return null;
  }

  // Only create a new client if one doesn't exist or if we need to retry
  const now = Date.now();
  if (!squareClient && (now - lastConnectionAttempt > CONNECTION_RETRY_INTERVAL)) {
    try {
      lastConnectionAttempt = now;
      squareClient = new Client({
        accessToken: env.SQUARE_ACCESS_TOKEN,
        environment: env.SQUARE_ENVIRONMENT === 'production'
          ? Environment.Production
          : Environment.Sandbox
      });

      // Update system status with successful connection
      getSystemStatus().squareApiStatus = 'connected';
    } catch (error) {
      console.error('Failed to initialize Square client:', error);
      getSystemStatus().squareApiStatus = 'error';
      getSystemStatus().lastError = {
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Unknown error initializing Square client'
      };
      return null;
    }
  }

  return squareClient;
}

export async function verifyMembership(phoneNumber: string): Promise<CheckInResult> {
  try {
    // Initialize Square client with environment variables
    const client = initSquareClient();

    // If client is null, return a friendly error message
    if (!client) {
      return {
        success: false,
        message: 'Unable to connect to membership system. Please try again later or contact staff.',
        error: 'SQUARE_CLIENT_UNAVAILABLE'
      };
    }

    // Search for customer by phone number
    try {
      const { result } = await client.customersApi.searchCustomers({
        query: {
          filter: {
            phoneNumber: {
              exact: phoneNumber
            }
          }
        }
      });

      if (!result.customers || result.customers.length === 0) {
        return {
          success: false,
          message: 'No customer found with this phone number',
          error: 'CUSTOMER_NOT_FOUND'
        };
      }

      const customer = result.customers[0];

      try {
        // 1. Check for active subscription (£25/month card payments)
        const subscriptionsResponse = await client.subscriptionsApi.searchSubscriptions({
          query: {
            filter: {
              customerIds: [customer.id!]
            }
          }
        });

        // Check if customer has active subscription
        const activeSubscription = subscriptionsResponse.result.subscriptions?.find(
          sub => sub.status === 'ACTIVE'
        );

        if (activeSubscription) {
          const result = validateSubscription(customer, activeSubscription);
          if (result.success) {
            // Log successful check-in via webhook
            triggerWebhook('check-in', {
              customerId: customer.id,
              customerName: `${customer.givenName || ''} ${customer.familyName || ''}`.trim(),
              phoneNumber,
              checkInTime: new Date().toISOString(),
              membershipType: 'subscription'
            }).catch(err => console.error('Failed to trigger webhook:', err));
          }
          return result;
        }
      } catch (subscriptionError) {
        console.error('Error checking subscriptions:', subscriptionError);
        // Continue to check for cash payments even if subscription check fails
      }

      try {
        // 2. Check for recent transactions (£30/month cash payments)
        // Get transactions from the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const formattedDate = thirtyDaysAgo.toISOString();

        const transactionsResponse = await client.ordersApi.searchOrders({
          locationIds: ['*'], // Search all locations
          query: {
            filter: {
              customerIds: [customer.id!],
              dateTimeFilter: {
                createdAt: {
                  startAt: formattedDate
                }
              },
              stateFilter: {
                states: ['COMPLETED']
              }
            }
          }
        });

        // Check if there's a cash payment of £30 in the last 30 days
        const recentCashPayment = transactionsResponse.result.orders?.find(order => {
          // Check if this is a cash payment of approximately £30
          // This is a simplified check - you may need to adjust based on your exact payment structure
          const totalMoney = order.totalMoney?.amount;
          return totalMoney && (totalMoney >= 2900 && totalMoney <= 3100); // £29-£31 range (in pence)
        });

        if (recentCashPayment) {
          const result = validateCashPayment(customer, recentCashPayment);
          if (result.success) {
            // Log successful check-in via webhook
            triggerWebhook('check-in', {
              customerId: customer.id,
              customerName: `${customer.givenName || ''} ${customer.familyName || ''}`.trim(),
              phoneNumber,
              checkInTime: new Date().toISOString(),
              membershipType: 'cash'
            }).catch(err => console.error('Failed to trigger webhook:', err));
          }
          return result;
        }
      } catch (transactionError) {
        console.error('Error checking transactions:', transactionError);
        // Continue to return inactive membership if transaction check fails
      }

      // No active subscription or recent cash payment found
      return {
        success: false,
        message: 'No active membership found',
        error: 'NO_ACTIVE_MEMBERSHIP',
        customerData: formatCustomerData(customer, {
          membershipStatus: 'Inactive',
          paymentStatus: 'No active subscription or recent payment'
        })
      };
    } catch (searchError) {
      console.error('Error searching for customer:', searchError);
      return {
        success: false,
        message: 'Error searching for customer. Please try again.',
        error: 'CUSTOMER_SEARCH_ERROR'
      };
    }
  } catch (error) {
    console.error('Error verifying membership:', error);

    // Update system status with error
    getSystemStatus().lastError = {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : 'Unknown error verifying membership'
    };

    return {
      success: false,
      message: 'An unexpected error occurred. Please try again later or contact staff.',
      error: 'UNEXPECTED_ERROR'
    };
  }
}

// Function to test Square API connection
export async function testSquareConnection(): Promise<{
  success: boolean;
  environment: string;
  message: string;
}> {
  try {
    const client = initSquareClient();
    if (!client) {
      return {
        success: false,
        environment: getEnv().SQUARE_ENVIRONMENT,
        message: 'Failed to initialize Square client. Check your access token.'
      };
    }

    // Make a simple API call to verify connection
    const response = await client.locationsApi.listLocations();

    if (response.result && response.result.locations) {
      getSystemStatus().squareApiStatus = 'connected';
      return {
        success: true,
        environment: getEnv().SQUARE_ENVIRONMENT,
        message: `Successfully connected to Square API. Found ${response.result.locations.length} locations.`
      };
    } else {
      getSystemStatus().squareApiStatus = 'error';
      return {
        success: false,
        environment: getEnv().SQUARE_ENVIRONMENT,
        message: 'Connected to Square API but received unexpected response.'
      };
    }
  } catch (error) {
    console.error('Error testing Square connection:', error);
    getSystemStatus().squareApiStatus = 'error';
    getSystemStatus().lastError = {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : 'Unknown error testing Square connection'
    };

    return {
      success: false,
      environment: getEnv().SQUARE_ENVIRONMENT,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
