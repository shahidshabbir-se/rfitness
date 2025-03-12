import { json } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { eventStream } from '~/utils/sse.server';
import { requireAdmin } from '~/utils/session.server';

export async function loader({ request }: LoaderFunctionArgs) {
  // Ensure only authenticated admins can access the SSE stream
  try {
    await requireAdmin(request);
  } catch (error) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Return the event stream
  return eventStream(request.signal, (send) => {
    // The send function is automatically added to the event emitter in eventStream
    
    // Return a cleanup function
    return () => {
      // Cleanup is handled in eventStream
    };
  });
} 