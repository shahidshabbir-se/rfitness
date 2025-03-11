import { getEnv } from './env.server';
import type { WebhookStatusData } from '~/types';

type WebhookEvent = 'check-in' | 'error' | 'system-status';

export async function triggerWebhook(
  event: WebhookEvent,
  data: Record<string, any>
): Promise<boolean> {
  const env = getEnv();
  // In development or if no webhook URL is configured, just log and return
  if (!env.WEBHOOK_URL) {
    console.log(`[Webhook ${event}]`, data);
    return true;
  }

  try {
    const response = await fetch(env.WEBHOOK_URL, {
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
  const webhookUrl = env.WEBHOOK_URL;
  const isConfigured = Boolean(webhookUrl && webhookUrl.length > 0);
  
  return {
    status: isConfigured ? 'configured' : 'not_configured',
    message: isConfigured 
      ? `Webhook configured at ${webhookUrl}` 
      : 'Webhook not configured',
    lastReceived: null, // We don't track this yet
    signatureValid: isConfigured // Assume valid if configured
  };
}
