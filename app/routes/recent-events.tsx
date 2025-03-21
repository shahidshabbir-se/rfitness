import { json } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { requireAdmin } from '~/utils/session.server';
import { getRecentCheckIns } from '~/models/check-in.server';
import { getSystemLogs } from '~/models/system-log.server';
import type { CheckInRecord } from '~/types';
import type { CheckIn, SystemLog } from '~/types';

/**
 * API endpoint for fetching recent check-ins and events
 * Used for polling instead of SSE
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Ensure only authenticated admins can access this endpoint
    await requireAdmin(request);
    
    // Get URL parameters
    const url = new URL(request.url);
    const since = url.searchParams.get('since');
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    
    // Parse the since timestamp or use a recent default
    let sinceDate: Date;
    if (since) {
      sinceDate = new Date(since);
      // If invalid date, use default
      if (isNaN(sinceDate.getTime())) {
        sinceDate = new Date();
        sinceDate.setMinutes(sinceDate.getMinutes() - 5); // Last 5 minutes
      }
    } else {
      sinceDate = new Date();
      sinceDate.setMinutes(sinceDate.getMinutes() - 5); // Last 5 minutes
    }
    
    // Get recent check-ins from database
    const checkInsData = await getRecentCheckIns(1, limit);
    
    // Get recent system logs for customer and subscription updates
    const { logs: customerLogs } = await getSystemLogs({
      page: 1,
      limit,
      eventType: 'customer_webhook',
      after: sinceDate
    });
    
    const { logs: subscriptionLogs } = await getSystemLogs({
      page: 1,
      limit,
      eventType: 'subscription_webhook',
      after: sinceDate
    });
    
    // Get check-in system logs (both successful and failed)
    const { logs: checkInSystemLogs } = await getSystemLogs({
      page: 1,
      limit,
      eventType: 'check_in',
      after: sinceDate
    });
    
    // Transform check-ins to the expected format
    const checkInRecords: CheckInRecord[] = checkInsData.checkIns
      .filter((checkIn: any) => new Date(checkIn.checkInTime) > sinceDate)
      .map((checkIn: any) => ({
        id: checkIn.id.toString(),
        timestamp: checkIn.checkInTime.toISOString(),
        customerName: checkIn.customerName || (checkIn.customer?.name) || 'Unknown',
        phoneNumber: checkIn.phoneNumber || (checkIn.customer?.phoneNumber) || '',
        success: true, // All stored check-ins are successful
        membershipType: checkIn.membershipType || (checkIn.customer?.membershipType) || 'Unknown',
        message: 'Check-in successful',
        nextPayment: '', // We don't have this information yet
        initials: (checkIn.customerName || (checkIn.customer?.name) || 'Unknown')
          .split(' ')
          .map((name: string) => name[0])
          .join('')
          .substring(0, 2)
      }));
    
    // Transform check-in system logs to the expected format
    const checkInLogEvents = checkInSystemLogs.map((log: SystemLog) => ({
      id: `check-in-log-${log.id}`,
      timestamp: log.timestamp.toISOString(),
      customerName: log.details?.customerName || log.message.split(' for ')[1] || 'Unknown',
      phoneNumber: log.details?.phoneNumber || '',
      success: log.details?.success === true || log.message.includes('successful'),
      membershipType: log.details?.membershipType || 'Unknown',
      message: log.message,
      nextPayment: '',
      initials: log.details?.customerName 
        ? log.details.customerName.split(' ').map((n: string) => n[0]).join('').substring(0, 2) 
        : 'CK',
      eventType: 'check-in' // Convert check_in to check-in for frontend compatibility
    }));
    
    // Transform customer logs to the expected format
    const customerEvents = customerLogs.map((log: SystemLog) => ({
      id: `customer-update-${log.id}`,
      timestamp: log.timestamp.toISOString(),
      customerName: log.details?.customerName || 'Customer',
      phoneNumber: log.details?.phoneNumber || '',
      success: true,
      membershipType: 'Update',
      message: `Customer ${log.details?.eventType?.split('.')?.[1] || 'updated'}: ${log.details?.customerName || 'Unknown'}`,
      nextPayment: '',
      initials: log.details?.customerName 
        ? log.details.customerName.split(' ').map((n: string) => n[0]).join('').substring(0, 2) 
        : 'CU',
      eventType: 'customer-update'
    }));
    
    // Transform subscription logs to the expected format
    const subscriptionEvents = subscriptionLogs.map((log: SystemLog) => ({
      id: `subscription-update-${log.id}`,
      timestamp: log.timestamp.toISOString(),
      customerName: 'Subscription Update',
      phoneNumber: log.details?.customerId || '',
      success: log.details?.status === 'ACTIVE',
      membershipType: 'Subscription',
      message: `Subscription ${log.details?.eventType?.split('.')?.[1] || 'updated'}: ${log.details?.status || 'Unknown'}`,
      nextPayment: '',
      initials: 'SU',
      eventType: 'subscription-update'
    }));
    
    // Combine all events and sort by timestamp (newest first)
    const allEvents = [...checkInRecords, ...checkInLogEvents, ...customerEvents, ...subscriptionEvents]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return json({
      events: allEvents,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching recent events:', error);
    return json({ 
      error: 'Failed to fetch recent events',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Add a default export to ensure Remix recognizes this as a route
export default function RecentEventsRoute() {
  return null; // This component won't render anything as it's just an API endpoint
}