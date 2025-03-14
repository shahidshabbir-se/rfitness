/**
 * @deprecated This entire module is deprecated and will be removed in a future version.
 * The application has switched from SSE to polling for real-time updates.
 * See /api/recent-events.tsx for the new implementation.
 * 
 * This file is kept temporarily for backward compatibility but will be removed.
 * Do not use any functions from this file in new code.
 */

import type { CheckInRecord } from '~/types';

// Define the event emitter type
type SendFunction = (event: string, data: any) => void;

// Define event types
export type SSEEventType = 'check-in' | 'webhook' | 'customer-update' | 'subscription-update';

/**
 * @deprecated Do not use this class in new code.
 */
class CheckInEventEmitter {
  private listeners: Set<SendFunction> = new Set();

  addListener(listener: SendFunction) {
    console.warn('SSE is deprecated. Use polling with /api/recent-events instead.');
    this.listeners.add(listener);
  }

  removeListener(listener: SendFunction) {
    this.listeners.delete(listener);
  }

  emit(eventType: SSEEventType, data: any) {
    console.warn('SSE is deprecated. Use polling with /api/recent-events instead.');
    console.log(`[Deprecated] SSE event emitted: ${eventType}`, data);
  }
}

// Create a singleton instance of the event emitter
let eventEmitterInstance: CheckInEventEmitter | null = null;

/**
 * @deprecated Do not use this function in new code.
 */
function getEventEmitter(): CheckInEventEmitter {
  console.warn('SSE is deprecated. Use polling with /api/recent-events instead.');
  if (!eventEmitterInstance) {
    eventEmitterInstance = new CheckInEventEmitter();
  }
  return eventEmitterInstance;
}

/**
 * Create a server-sent event stream
 * @deprecated Do not use this function in new code. Use polling with /api/recent-events instead.
 */
export function eventStream(signal: AbortSignal, callback: (send: SendFunction) => () => void) {
  console.warn('SSE is deprecated. Use polling with /api/recent-events instead.');
  
  // Set up headers for SSE
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Create a new ReadableStream
  const stream = new ReadableStream({
    start(controller) {
      // Send function to emit events
      const send = (event: string, data: any) => {
        controller.enqueue(new TextEncoder().encode(`event: ${event}\n`));
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Send initial connection established event
      send('connected', { 
        message: 'Connection established',
        deprecated: true,
        alternativeEndpoint: '/api/recent-events'
      });

      // Set up ping interval to keep connection alive
      const pingInterval = setInterval(() => {
        send('ping', { time: new Date().toISOString() });
      }, 30000);

      // Add listener to the event emitter
      const emitter = getEventEmitter();
      emitter.addListener(send);

      // Set up cleanup function
      const cleanup = callback(send);

      // Handle abort signal
      signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        emitter.removeListener(send);
        cleanup();
        controller.close();
      });
    },
  });

  return new Response(stream, { headers });
}

/**
 * Emit a check-in event to all connected clients
 * @deprecated Do not use this function in new code. Events are now stored in the database for polling.
 */
export function emitCheckInEvent(checkInRecord: CheckInRecord) {
  console.warn('SSE is deprecated. Use polling with /api/recent-events instead.');
  console.log('[Deprecated] Check-in event emitted:', checkInRecord.id);
}

/**
 * Emit a webhook event to all connected clients
 * @deprecated Do not use this function in new code. Events are now stored in the database for polling.
 */
export function emitWebhookEvent(eventType: 'customer-update' | 'subscription-update', data: any) {
  console.warn('SSE is deprecated. Use polling with /api/recent-events instead.');
  console.log(`[Deprecated] Webhook event emitted: ${eventType}`);
} 