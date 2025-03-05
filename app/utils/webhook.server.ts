import { getEnv } from './env.server';

type WebhookEvent = 'check-in' | 'error' | 'system-status';

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
    
    return true;
  } catch (error) {
    console.error('Error triggering webhook:', error);
    return false;
  }
}
