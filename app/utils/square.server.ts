import pkg from "square";
const { Client, Environment } = pkg;
import type { SquareConfig, CheckInResult } from "~/types";
import { formatCustomerData } from "./formatters.server";
import { validateSubscription, validateCashPayment } from "./membership.server";
import { getEnv } from "./env.server";
import { triggerWebhook } from "./webhook.server";
import { getSystemStatus } from "./system.server";

let squareClient: Client | null = null;
let lastConnectionAttempt = 0;
const CONNECTION_RETRY_INTERVAL = 60000; // 1 minute

export function initSquareClient(): Client | null {
  const env = getEnv();

  // If no access token is provided, return null instead of throwing
  if (!env.SQUARE_ACCESS_TOKEN) {
    console.warn("Square access token not provided");
    return null;
  }

  // Only create a new client if one doesn't exist or if we need to retry
  const now = Date.now();
  if (
    !squareClient &&
    now - lastConnectionAttempt > CONNECTION_RETRY_INTERVAL
  ) {
    try {
      lastConnectionAttempt = now;
      squareClient = new Client({
        accessToken: env.SQUARE_ACCESS_TOKEN,
        environment:
          env.SQUARE_ENVIRONMENT === "production"
            ? Environment.Production
            : Environment.Sandbox,
      });

      // Update system status with successful connection
      getSystemStatus().squareApiStatus = "connected";
    } catch (error) {
      console.error("Failed to initialize Square client:", error);
      getSystemStatus().squareApiStatus = "error";
      getSystemStatus().lastError = {
        timestamp: new Date().toISOString(),
        message:
          error instanceof Error
            ? error.message
            : "Unknown error initializing Square client",
      };
      return null;
    }
  }

  return squareClient;
}

export async function verifyMembership(
  phoneNumber: string
): Promise<CheckInResult> {
  try {
    // Initialize Square client with environment variables
    const client = initSquareClient();

    // If client is null, return a friendly error message
    if (!client) {
      return {
        success: false,
        message:
          "Unable to connect to membership system. Please try again later or contact staff.",
        error: "SQUARE_CLIENT_UNAVAILABLE",
      };
    }

    // Search for customer by phone number
    try {
      const { result } = await client.customersApi.searchCustomers({
        query: {
          filter: {
            phoneNumber: {
              exact: phoneNumber,
            },
          },
        },
      });

      if (!result.customers || result.customers.length === 0) {
        return {
          success: false,
          message: "No customer found with this phone number",
          error: "CUSTOMER_NOT_FOUND",
        };
      }

      const customer = result.customers[0];

      try {
        // 1. Check for active subscription (£25/month card payments)
        const subscriptionsResponse =
          await client.subscriptionsApi.searchSubscriptions({
            query: {
              filter: {
                customerIds: [customer.id!],
              },
            },
          });

        // Check if customer has active subscription
        const activeSubscription =
          subscriptionsResponse.result.subscriptions?.find(
            (sub) => sub.status === "ACTIVE"
          );

        if (activeSubscription) {
          const result = validateSubscription(customer, activeSubscription);
          if (result.success) {
            // Log successful check-in via webhook
            triggerWebhook("check-in", {
              customerId: customer.id,
              customerName:
                `${customer.givenName || ""} ${customer.familyName || ""}`.trim(),
              phoneNumber,
              checkInTime: new Date().toISOString(),
              membershipType: "subscription",
            }).catch((err) => console.error("Failed to trigger webhook:", err));
          }
          return result;
        }
      } catch (subscriptionError) {
        console.error("Error checking subscriptions:", subscriptionError);
        // Continue to check for cash payments even if subscription check fails
      }

      try {
        // 2. Check for recent payments (£30/month cash payments)
        // Get payments from the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const formattedDate = thirtyDaysAgo.toISOString();

        // Use Payments API instead of Orders API
        const paymentsResponse = await client.paymentsApi.listPayments(
          formattedDate, // beginTime
          undefined, // endTime
          undefined, // sortOrder
          undefined, // cursor
          undefined, // locationId
          undefined, // total
          undefined, // last4
          undefined, // cardBrand
          undefined, // limit
          {
            customerId: customer.id,
          }
        );

        // Check if there's a cash payment of £30 in the last 30 days
        const recentCashPayment = paymentsResponse.result.payments?.find(
          (payment) => {
            // Check if this is a cash payment of approximately £30
            const totalMoney = payment.totalMoney?.amount;
            const isCashPayment = payment.sourceType === "CASH";
            return (
              isCashPayment &&
              totalMoney &&
              totalMoney >= 2900 &&
              totalMoney <= 3100
            ); // £29-£31 range (in pence)
          }
        );

        if (recentCashPayment) {
          const result = validateCashPayment(customer, recentCashPayment);
          if (result.success) {
            // Log successful check-in via webhook
            triggerWebhook("check-in", {
              customerId: customer.id,
              customerName:
                `${customer.givenName || ""} ${customer.familyName || ""}`.trim(),
              phoneNumber,
              checkInTime: new Date().toISOString(),
              membershipType: "cash",
            }).catch((err) => console.error("Failed to trigger webhook:", err));
          }
          return result;
        }
      } catch (paymentError) {
        console.error("Error checking payments:", paymentError);
        // Continue to return inactive membership if payment check fails
      }

      // No active subscription or recent cash payment found
      return {
        success: false,
        message: "No active membership found",
        error: "NO_ACTIVE_MEMBERSHIP",
        customerData: formatCustomerData(customer, {
          membershipStatus: "Inactive",
          paymentStatus: "No active subscription or recent payment",
        }),
      };
    } catch (error) {
      console.error("Error searching for customer:", error);
      return {
        success: false,
        message: "Error searching for customer",
        error: "CUSTOMER_SEARCH_ERROR",
      };
    }
  } catch (error) {
    console.error("Unexpected error in verifyMembership:", error);
    return {
      success: false,
      message: "An unexpected error occurred",
      error: "UNEXPECTED_ERROR",
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
        message: "Failed to initialize Square client. Check your access token.",
      };
    }

    // Make a simple API call to verify connection
    const response = await client.locationsApi.listLocations();

    if (response.result && response.result.locations) {
      getSystemStatus().squareApiStatus = "connected";
      return {
        success: true,
        environment: getEnv().SQUARE_ENVIRONMENT,
        message: `Successfully connected to Square API. Found ${response.result.locations.length} locations.`,
      };
    } else {
      getSystemStatus().squareApiStatus = "error";
      return {
        success: false,
        environment: getEnv().SQUARE_ENVIRONMENT,
        message: "Connected to Square API but received unexpected response.",
      };
    }
  } catch (error) {
    console.error("Error testing Square connection:", error);
    getSystemStatus().squareApiStatus = "error";
    getSystemStatus().lastError = {
      timestamp: new Date().toISOString(),
      message:
        error instanceof Error
          ? error.message
          : "Unknown error testing Square connection",
    };

    return {
      success: false,
      environment: getEnv().SQUARE_ENVIRONMENT,
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Get members needing renewal from Square API
 */
export async function getMembersNeedingRenewal(): Promise<{
  count: number;
  members: Array<{
    id: string;
    name: string;
    phoneNumber: string;
    membershipType: string;
    expiryDate: string;
    status: string;
    initials: string;
  }>;
}> {
  try {
    // Initialize Square client
    const client = initSquareClient();

    if (!client) {
      console.warn(
        "Square client not available for getting members needing renewal"
      );
      return { count: 0, members: [] };
    }

    // Get all customers
    const { result } = await client.customersApi.listCustomers();

    if (!result.customers || result.customers.length === 0) {
      return { count: 0, members: [] };
    }

    const membersNeedingRenewal: Array<{
      id: string;
      name: string;
      phoneNumber: string;
      membershipType: string;
      expiryDate: string;
      status: string;
      initials: string;
    }> = [];

    // Check each customer's subscription and payment status
    for (const customer of result.customers) {
      try {
        // Skip customers without phone numbers
        if (!customer.phoneNumber) continue;

        const customerId = customer.id || "";
        if (!customerId) continue;

        // Check subscription status
        const subscriptionsResponse =
          await client.subscriptionsApi.searchSubscriptions({
            query: {
              filter: {
                customerIds: [customerId],
              },
            },
          });

        // Check if customer has active subscription
        const subscription = subscriptionsResponse.result.subscriptions?.find(
          (sub) => sub.status === "ACTIVE"
        );

        if (subscription) {
          // Check if subscription is about to expire
          if (subscription.charged_through_date) {
            const expiryDate = new Date(subscription.charged_through_date);
            const now = new Date();
            const daysUntilExpiry = Math.floor(
              (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            // If subscription expires within 5 days or has already expired
            if (daysUntilExpiry <= 5) {
              const status = daysUntilExpiry < 0 ? "Expired" : "Expiring Soon";

              // Generate initials from name
              const fullName =
                `${customer.givenName || ""} ${customer.familyName || ""}`.trim();
              const initials = fullName
                .split(" ")
                .map((name) => name.charAt(0))
                .join("")
                .substring(0, 2);

              const phoneNumber = customer.phoneNumber || "";

              membersNeedingRenewal.push({
                id: customerId,
                name: fullName,
                phoneNumber,
                membershipType: "Monthly Subscription (£25)",
                expiryDate: expiryDate.toISOString(),
                status,
                initials: initials || "UN",
              });
            }
          }
          continue; // Skip cash payment check if they have a subscription
        }

        // Check for recent cash payments
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Use Payments API instead of Orders API
        const paymentsResponse = await client.paymentsApi.listPayments(
          thirtyDaysAgo.toISOString(), // beginTime
          undefined, // endTime
          undefined, // sortOrder
          undefined, // cursor
          undefined, // locationId
          undefined, // total
          undefined, // last4
          undefined, // cardBrand
          undefined, // limit
          {
            customerId: customerId,
          }
        );

        // Find most recent cash payment of approximately £30
        const recentCashPayment = paymentsResponse.result.payments?.find(
          (payment) => {
            // Check if this is a cash payment of approximately £30
            const totalMoney = payment.totalMoney?.amount;
            const isCashPayment = payment.sourceType === "CASH";
            return (
              isCashPayment &&
              totalMoney &&
              totalMoney >= 2900 &&
              totalMoney <= 3100
            ); // £29-£31 range (in pence)
          }
        );

        if (recentCashPayment && recentCashPayment.createdAt) {
          // Calculate expiry date (30 days from payment)
          const paymentDate = new Date(recentCashPayment.createdAt);
          const expiryDate = new Date(paymentDate);
          expiryDate.setDate(paymentDate.getDate() + 30);

          const now = new Date();
          const daysUntilExpiry = Math.floor(
            (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          // If cash payment expires within 5 days or has already expired
          if (daysUntilExpiry <= 5) {
            const status = daysUntilExpiry < 0 ? "Expired" : "Expiring Soon";

            // Generate initials from name
            const fullName =
              `${customer.givenName || ""} ${customer.familyName || ""}`.trim();
            const initials = fullName
              .split(" ")
              .map((name) => name.charAt(0))
              .join("")
              .substring(0, 2);

            const phoneNumber = customer.phoneNumber || "";

            membersNeedingRenewal.push({
              id: customerId,
              name: fullName,
              phoneNumber,
              membershipType: "Cash Payment (£30)",
              expiryDate: expiryDate.toISOString(),
              status,
              initials: initials || "UN",
            });
          }
        } else {
          // No active subscription or recent cash payment - consider as needing renewal
          // Generate initials from name
          const fullName =
            `${customer.givenName || ""} ${customer.familyName || ""}`.trim();
          const initials = fullName
            .split(" ")
            .map((name) => name.charAt(0))
            .join("")
            .substring(0, 2);

          const phoneNumber = customer.phoneNumber || "";

          membersNeedingRenewal.push({
            id: customerId,
            name: fullName,
            phoneNumber,
            membershipType: "Unknown",
            expiryDate: new Date().toISOString(), // Already expired
            status: "Expired",
            initials: initials || "UN",
          });
        }
      } catch (error) {
        console.error(
          `Error checking renewal status for customer ${customer.id}:`,
          error
        );
        // Continue with next customer
      }
    }

    // Sort by status priority: Expired first, then Expiring Soon
    membersNeedingRenewal.sort((a, b) => {
      const statusPriority = { Expired: 0, "Expiring Soon": 1 };
      return (
        statusPriority[a.status as keyof typeof statusPriority] -
        statusPriority[b.status as keyof typeof statusPriority]
      );
    });

    return {
      count: membersNeedingRenewal.length,
      members: membersNeedingRenewal,
    };
  } catch (error) {
    console.error("Error getting members needing renewal:", error);
    return { count: 0, members: [] };
  }
}
