# Square API Integration Documentation

This document provides comprehensive details about the Square API integration in the Gym Check-in System. It serves as a reference for developers working with the Square-related functionality.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Customer Management](#customer-management)
4. [Subscription Verification](#subscription-verification)
5. [Payment Verification](#payment-verification)
6. [Webhook Integration](#webhook-integration)
7. [Error Handling](#error-handling)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

## Overview

The Gym Check-in System integrates with Square's API to:

- Verify customer identity and membership status
- Check subscription status for recurring memberships
- Validate recent payments for cash-based memberships
- Receive real-time updates via webhooks
- Manage customer data and check-in history

The integration uses the official Square Node.js SDK and follows Square's best practices for API usage.

## Authentication

### Configuration

Authentication with Square is handled through an access token. The application supports both sandbox (testing) and production environments.

```typescript
// app/utils/square.server.ts
import { Client, Environment } from 'square';
import type { SquareConfig } from '~/types';

export function initSquareClient(config: SquareConfig): Client {
  return new Client({
    accessToken: config.accessToken,
    environment: config.environment === 'production' 
      ? Environment.Production 
      : Environment.Sandbox
  });
}
```

### Environment Variables

The following environment variables are required for Square authentication:

- `SQUARE_ACCESS_TOKEN`: Your Square API access token
- `SQUARE_ENVIRONMENT`: Either 'sandbox' or 'production'

Optional environment variables:

- `SQUARE_WEBHOOK_SIGNATURE_KEY`: For webhook verification
- `SQUARE_LOCATION_ID`: For location-specific operations

## Customer Management

### Customer Lookup

The system looks up customers by phone number using Square's Customer API:

```typescript
// Example from app/utils/square.server.ts
const { result } = await squareClient.customersApi.searchCustomers({
  query: {
    filter: {
      phoneNumber: {
        exact: phoneNumber
      }
    }
  }
});
```

### Customer Data Format

Customer data is formatted using a utility function:

```typescript
// app/utils/formatters.server.ts
export function formatCustomerData(customer, additionalInfo = {}) {
  return {
    id: customer.id,
    firstName: customer.givenName,
    lastName: customer.familyName,
    phoneNumber: customer.phoneNumber,
    email: customer.emailAddress,
    createdAt: new Date(customer.createdAt).toLocaleDateString(),
    ...additionalInfo
  };
}
```

## Subscription Verification

The system verifies active subscriptions using Square's Subscriptions API:

```typescript
// Example from app/utils/square.server.ts
const subscriptionsResponse = await squareClient.subscriptionsApi.searchSubscriptions({
  query: {
    filter: {
      customerIds: [customer.id]
    }
  }
});

const activeSubscription = subscriptionsResponse.result.subscriptions?.find(
  sub => sub.status === 'ACTIVE'
);
```

### Subscription Validation Logic

Subscription validation is handled by a dedicated function:

```typescript
// app/utils/membership.server.ts
export function validateSubscription(customer, subscription) {
  // Validation logic for subscription-based memberships
  // Returns a CheckInResult object
}
```

## Payment Verification

For cash-based memberships, the system checks for recent payments using Square's Payments API:

```typescript
// Example from app/utils/square.server.ts
const paymentsResponse = await squareClient.paymentsApi.listPayments(
  formattedDate,  // beginTime (30 days ago)
  undefined,      // endTime
  undefined,      // sortOrder
  undefined,      // cursor
  undefined,      // locationId
  undefined,      // total
  undefined,      // last4
  undefined,      // cardBrand
  undefined,      // limit
  {
    customerId: customer.id
  }
);

// Check for cash payment of approximately £30
const recentCashPayment = paymentsResponse.result.payments?.find(payment => {
  const totalMoney = payment.totalMoney?.amount;
  const isCashPayment = payment.sourceType === 'CASH';
  return isCashPayment && totalMoney && (totalMoney >= 2900 && totalMoney <= 3100);
});
```

### Cash Payment Validation Logic

Cash payment validation is handled by a dedicated function:

```typescript
// app/utils/membership.server.ts
export function validateCashPayment(customer, payment) {
  // Validation logic for cash payment-based memberships
  // Returns a CheckInResult object
}
```

## Webhook Integration

The system supports Square webhooks for real-time updates.

### Webhook Endpoint

The webhook endpoint is defined in `app/routes/webhook.tsx` and processes incoming webhook events from Square.

### Webhook Verification

Webhooks are verified using Square's signature verification:

```typescript
// app/utils/webhook.server.ts
import { webhookSignatureVerifier } from 'square';

export async function verifyWebhookSignature(
  signature: string,
  body: string,
  signatureKey: string
): Promise<boolean> {
  try {
    return await webhookSignatureVerifier.isValidWebhookEventSignature(
      body,
      signature,
      signatureKey,
      new URL('https://your-domain.com/webhook').toString()
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return false;
  }
}
```

### Webhook Event Types

The system handles the following webhook event types:

- `customer.created`
- `customer.updated`
- `customer.deleted`
- `subscription.created`
- `subscription.updated`
- `subscription.canceled`
- `payment.created`
- `payment.updated`

### Webhook Processing

Webhook events are processed based on their type:

```typescript
// app/utils/webhook.server.ts
export async function processWebhookEvent(eventType: string, eventData: any) {
  switch (eventType) {
    case 'customer.created':
    case 'customer.updated':
      // Handle customer updates
      break;
    case 'subscription.created':
    case 'subscription.updated':
    case 'subscription.canceled':
      // Handle subscription updates
      break;
    case 'payment.created':
    case 'payment.updated':
      // Handle payment updates
      break;
    default:
      console.log(`Unhandled webhook event type: ${eventType}`);
  }
}
```

## Error Handling

The system implements robust error handling for Square API interactions:

```typescript
// Example error handling pattern
try {
  // Square API call
} catch (error) {
  if (error.statusCode === 401) {
    // Handle authentication error
  } else if (error.statusCode === 429) {
    // Handle rate limiting
  } else {
    // Handle other errors
    console.error('Square API error:', error);
  }
  
  return {
    success: false,
    message: 'Error verifying membership',
    error: error.message
  };
}
```

### Common Error Scenarios

1. **Authentication Errors (401)**: Invalid or expired access token
2. **Rate Limiting (429)**: Too many requests in a short period
3. **Not Found (404)**: Customer or resource doesn't exist
4. **Bad Request (400)**: Invalid request parameters
5. **Server Error (500)**: Square API internal error

## Testing

### Sandbox Environment

For testing, use the Square Sandbox environment:

```
SQUARE_ENVIRONMENT=sandbox
SQUARE_ACCESS_TOKEN=your_sandbox_token
```

### Test Customers

Create test customers in the Square Sandbox Dashboard with:
- Valid phone numbers for testing
- Different subscription statuses
- Various payment histories

### Mock Mode

The application includes a mock mode for development without Square API access:

```typescript
// app/utils/square.server.ts
export function isSquareConfigured(): boolean {
  try {
    const env = getEnv();
    return !!env.SQUARE_ACCESS_TOKEN;
  } catch {
    return false;
  }
}

// Usage example
if (!isSquareConfigured()) {
  return getMockCustomerData(phoneNumber); // Return mock data for development
}
```

## Troubleshooting

### Common Issues

1. **Invalid Access Token**
   - Error: `401 Unauthorized`
   - Solution: Verify your access token in the Square Developer Dashboard

2. **Rate Limiting**
   - Error: `429 Too Many Requests`
   - Solution: Implement exponential backoff and retry logic

3. **Customer Not Found**
   - Symptom: Empty result when searching for customers
   - Solution: Verify phone number format matches Square's format (e.g., +1XXXXXXXXXX)

4. **Webhook Verification Failures**
   - Symptom: Webhook events failing signature verification
   - Solution: Check signature key and ensure the webhook URL matches the one configured in Square

### Debugging Tips

1. Enable verbose logging for Square API calls:
   ```typescript
   const squareClient = new Client({
     // ... other options
     environment: Environment.Sandbox,
     userAgentDetail: 'Gym-Checkin-App', // Helps identify your app in logs
     timeout: 3000 // Timeout in milliseconds
   });
   ```

2. Use the Square Developer Dashboard to:
   - View API call history
   - Check webhook delivery status
   - Verify customer data

3. Implement logging for all Square API interactions:
   ```typescript
   console.log('Square API Request:', JSON.stringify(requestParams));
   try {
     const response = await squareClient.someApi.someMethod(requestParams);
     console.log('Square API Response:', JSON.stringify(response));
     return response;
   } catch (error) {
     console.error('Square API Error:', error);
     throw error;
   }
   ```

## API Reference

### Square SDK Version

The application uses Square SDK version 33.1.0:

```json
// package.json
{
  "dependencies": {
    "square": "^33.1.0"
  }
}
```

### Key Square APIs Used

1. **Customers API**
   - `searchCustomers`: Find customers by phone number
   - `retrieveCustomer`: Get detailed customer information

2. **Subscriptions API**
   - `searchSubscriptions`: Find active subscriptions for a customer
   - `retrieveSubscription`: Get detailed subscription information

3. **Payments API**
   - `listPayments`: Find recent payments for a customer

4. **Webhook API**
   - Webhook event handling and signature verification

### Rate Limits

Square API has the following rate limits:

- 100 requests per minute per application
- 5,000 requests per day per application

Implement appropriate rate limiting and caching strategies to avoid hitting these limits.

## Further Resources

- [Square Developer Documentation](https://developer.squareup.com/docs)
- [Square Node.js SDK Documentation](https://developer.squareup.com/docs/sdks/nodejs)
- [Square API Explorer](https://developer.squareup.com/explorer)
- [Square Developer Forum](https://developer.squareup.com/forums)
