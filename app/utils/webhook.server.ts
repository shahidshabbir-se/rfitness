import { getEnv } from './env.server';
import type { WebhookStatusData } from '~/types';

type WebhookEvent = 'check-in' | 'error' | 'system-status';

export async function triggerWebhook(
  event: WebhookEvent,
  data: Record<string, any>
): Promise<boolean> {
  const env = getEnv();
  // In development or if no webhook URL is configured, just log and return
  if (!env.SQUARE_WEBHOOK_URL) {
    console.log(`[Webhook ${event}]`, data);
    return true;
  }

  try {
    const response = await fetch(env.SQUARE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Source': 'gym-check-in',
        'X-Webhook-Event': event
      },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data
      })
    });

    if (!response.ok) {
      console.error(`Webhook error: ${response.status} ${response.statusText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error triggering webhook:', error);
    return false;
  }
}

// Get webhook status for admin dashboard
export function getWebhookStatus(): WebhookStatusData {
  const env = getEnv();

  // Log environment variables for debugging
  //console.log('Webhook Environment Variables:');
  //console.log('SQUARE_WEBHOOK_URL:', env.SQUARE_WEBHOOK_URL);
  //console.log('SQUARE_WEBHOOK_SIGNATURE_KEY:', env.SQUARE_WEBHOOK_SIGNATURE_KEY ? 'Set (not showing for security)' : 'Not set');
  //console.log('NODE_ENV:', env.NODE_ENV);

  const isConfigured = Boolean(env.SQUARE_WEBHOOK_URL && env.SQUARE_WEBHOOK_SIGNATURE_KEY);

  return {
    status: isConfigured ? 'configured' : 'warning',
    message: isConfigured
      ? 'Square webhooks are properly configured and ready to receive events'
      : 'Square webhooks are not configured. Some features may be limited.',
    lastReceived: null,
    signatureValid: isConfigured
  };
}
