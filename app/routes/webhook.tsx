import { json, type ActionFunctionArgs } from '@remix-run/node';
import { getEnv } from '~/utils/env.server';

export async function action({ request }: ActionFunctionArgs) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }
  
  try {
    const env = getEnv();
    const signature = request.headers.get('x-square-hmacsha256-signature');
    
    // Verify webhook signature (in a real app)
    if (!signature) {
      return json({ error: 'Missing signature' }, { status: 401 });
    }
    
    // In a real app, you would verify the signature using the webhook signature key
    // const isValid = verifyWebhookSignature(signature, await request.text(), env.SQUARE_WEBHOOK_SIGNATURE_KEY);
    // if (!isValid) {
    //   return json({ error: 'Invalid signature' }, { status: 401 });
    // }
    
    // Process the webhook payload
    const payload = await request.json();
    
    // In a real app, you would handle different event types
    // For example, if it's a payment.updated event, you might update the membership status
    
    // For now, just log the event type
    console.log(`Received webhook: ${payload.type}`);
    
    return json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

// This route doesn't render anything, it's just an API endpoint
export default function Webhook() {
  return null;
}
