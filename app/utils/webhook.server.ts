import type { WebhookEvent } from '~/types';
import { processCheckIn } from './check-in.server';
import type { CheckInRecord } from '~/types';

export async function triggerWebhook(
  event: WebhookEvent,
  data: Record<string, any>
): Promise<boolean> {
  // In development or if no webhook URL is configured, just log and return
  if (!process.env.WEBHOOK_URL) {
    console.log(`[Webhook ${event}]`, data);
    return true;
  }

  try {
    const response = await fetch(process.env.WEBHOOK_URL, {
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

    // If this is a check-in event, also process it for real-time notifications
    if (event === 'check-in' && data.checkInData) {
      processCheckIn(data.checkInData as CheckInRecord);
    }

    return true;
  } catch (error) {
    console.error('Error triggering webhook:', error);
    return false;
  }
}

// Mock webhook status for development
const webhookStatus = {
  status: 'healthy' as const,
  message: 'Webhooks are configured and working properly',
  lastReceived: new Date().toISOString(),
  signatureValid: true
};

export function getWebhookStatus() {
  return webhookStatus;
}
