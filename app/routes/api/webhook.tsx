import { json } from '@remix-run/node';
import type { ActionFunctionArgs } from '@remix-run/node';
import { createSystemLog } from '~/models/system-log.server';
import { updateSquareApiStatus, logSystemError } from '~/utils/system.server';
import { getEnv } from '~/utils/env.server';
import crypto from 'crypto';

export async function action({ request }: ActionFunctionArgs) {
  const env = getEnv();
  
  try {
    // Get the webhook signature from the request headers
    const signature = request.headers.get('x-square-hmacsha256-signature');
    if (!signature) {
      await logSystemError(new Error('Missing webhook signature'), 'webhook');
      await updateSquareApiStatus('error');
      return json({ error: 'Invalid webhook signature' }, { status: 401 });
    }
    
    // Get the raw request body for signature verification
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody);
    
    // Verify the webhook signature if the signature key is configured
    if (env.SQUARE_WEBHOOK_SIGNATURE_KEY) {
      const hmac = crypto.createHmac('sha256', env.SQUARE_WEBHOOK_SIGNATURE_KEY);
      hmac.update(rawBody);
      const calculatedSignature = hmac.digest('base64');
      
      if (calculatedSignature !== signature) {
        await logSystemError(new Error('Invalid webhook signature'), 'webhook');
        await updateSquareApiStatus('error');
        return json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    } else {
      // Log a warning if the signature key is not configured
      await createSystemLog({
        message: 'Webhook signature verification skipped: No signature key configured',
        eventType: 'webhook_warning',
        severity: 'warning',
        details: {
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Log webhook event to database
    await createSystemLog({
      message: `Received webhook: ${payload.type || 'unknown_type'}`,
      eventType: 'webhook_received',
      severity: 'info',
      details: {
        eventType: payload.type,
        eventId: payload.event_id,
        merchantId: payload.merchant_id,
        timestamp: new Date().toISOString(),
        payload: JSON.stringify(payload)
      }
    });
    
    // Update Square API status to connected since we received a webhook
    await updateSquareApiStatus('connected');
    
    // Process different webhook types
    switch (payload.type) {
      case 'customer.created':
      case 'customer.updated':
      case 'customer.deleted':
        // Handle customer events
        await handleCustomerEvent(payload);
        break;
      
      case 'subscription.created':
      case 'subscription.updated':
      case 'subscription.canceled':
        // Handle subscription events
        await handleSubscriptionEvent(payload);
        break;
      
      default:
        // Log unhandled event type
        await createSystemLog({
          message: `Unhandled webhook event type: ${payload.type}`,
          eventType: 'webhook_unhandled',
          severity: 'warning',
          details: {
            eventType: payload.type,
            eventId: payload.event_id,
            timestamp: new Date().toISOString()
          }
        });
    }
    
    return json({ success: true });
  } catch (error) {
    // Log error to database
    await logSystemError(error instanceof Error ? error : new Error(String(error)), 'webhook');
    
    // Update Square API status
    await updateSquareApiStatus('error');
    
    // Return error response
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleCustomerEvent(payload: any) {
  try {
    const data = payload.data.object.customer;
    
    await createSystemLog({
      message: `Processed customer event: ${payload.type}`,
      eventType: 'customer_webhook',
      severity: 'info',
      details: {
        eventType: payload.type,
        customerId: data.id,
        customerName: `${data.given_name || ''} ${data.family_name || ''}`.trim(),
        timestamp: new Date().toISOString()
      }
    });
    
    // TODO: Update customer in database
    // This would call customer.server.ts methods
  } catch (error) {
    await logSystemError(error instanceof Error ? error : new Error(String(error)), 'customer_webhook');
  }
}

async function handleSubscriptionEvent(payload: any) {
  try {
    const data = payload.data.object.subscription;
    
    await createSystemLog({
      message: `Processed subscription event: ${payload.type}`,
      eventType: 'subscription_webhook',
      severity: 'info',
      details: {
        eventType: payload.type,
        subscriptionId: data.id,
        customerId: data.customer_id,
        planId: data.plan_id,
        status: data.status,
        timestamp: new Date().toISOString()
      }
    });
    
    // TODO: Update subscription in database
    // This would call subscription.server.ts methods
  } catch (error) {
    await logSystemError(error instanceof Error ? error : new Error(String(error)), 'subscription_webhook');
  }
} 