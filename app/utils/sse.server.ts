import type { CheckInRecord } from '~/types';

// Define the event emitter type
type SendFunction = (event: string, data: any) => void;

// Define event types
export type SSEEventType = 'check-in' | 'webhook' | 'customer-update' | 'subscription-update';

// Create a global event emitter for check-in events
class CheckInEventEmitter {
  private listeners: Set<SendFunction> = new Set();

  addListener(listener: SendFunction) {
    this.listeners.add(listener);
  }

  removeListener(listener: SendFunction) {
    this.listeners.delete(listener);
  }

  emit(eventType: SSEEventType, data: any) {
    this.listeners.forEach(listener => {
      listener(eventType, data);
    });
  }
}

// Create a singleton instance of the event emitter
let eventEmitterInstance: CheckInEventEmitter | null = null;

function getEventEmitter(): CheckInEventEmitter {
  if (!eventEmitterInstance) {
    eventEmitterInstance = new CheckInEventEmitter();
  }
  return eventEmitterInstance;
}

/**
 * Create a server-sent event stream
 */
export function eventStream(signal: AbortSignal, callback: (send: SendFunction) => () => void) {
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
      send('connected', { message: 'Connection established' });

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
 */
export function emitCheckInEvent(checkInRecord: CheckInRecord) {
  const emitter = getEventEmitter();
  emitter.emit('check-in', checkInRecord);
}

/**
 * Emit a webhook event to all connected clients
 */
export function emitWebhookEvent(eventType: 'customer-update' | 'subscription-update', data: any) {
  const emitter = getEventEmitter();
  emitter.emit(eventType, {
    timestamp: new Date().toISOString(),
    ...data
  });
} 