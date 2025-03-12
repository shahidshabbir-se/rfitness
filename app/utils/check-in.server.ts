import type { CheckInRecord } from '~/types';
import { checkInEventEmitter } from '~/entry.server';
import { getEnv } from './env.server';

/**
 * Process a check-in and emit an event for real-time notifications
 */
export function processCheckIn(checkInData: CheckInRecord): void {
  // Log the check-in
  console.log(`Check-in processed: ${checkInData.customerName} (${checkInData.success ? 'Success' : 'Failed'})`);
  
  // In production, we want to emit the event for real-time notifications
  const env = getEnv();
  if (env.NODE_ENV === 'production' || env.ENABLE_REAL_TIME_NOTIFICATIONS === 'true') {
    // Emit the check-in event for SSE
    checkInEventEmitter.emit('check-in', checkInData);
  }
  
  // Here you would also save the check-in to your database
  // saveCheckInToDatabase(checkInData);
}

/**
 * Get recent check-ins from the database
 * This is a placeholder - in a real app, you would fetch from your database
 */
export async function getRecentCheckIns(limit: number = 20): Promise<CheckInRecord[]> {
  // In a real app, this would fetch from your database
  // For now, return an empty array
  return [];
} 