// System status tracking
import { createSystemLog, getSystemLogs } from '~/models/system-log.server';
import { getCheckInStats } from '~/models/check-in.server';
import { getCustomerStats } from '~/models/customer.server';
import { getEnv } from './env.server';

type SystemStatus = {
  squareApiStatus: 'connected' | 'error' | 'not_configured';
  lastError: {
    timestamp: string;
    message: string;
  } | null;
  lastCheckIn: {
    timestamp: string;
    customerName: string;
    success: boolean;
  } | null;
  startupTime: string;
};

// Initialize system status
const systemStatus: SystemStatus = {
  squareApiStatus: 'not_configured',
  lastError: null,
  lastCheckIn: null,
  startupTime: new Date().toISOString()
};

// Log system startup
(async () => {
  try {
    const env = getEnv();
    await createSystemLog({
      message: 'System started',
      eventType: 'system_startup',
      severity: 'info',
      details: {
        startupTime: systemStatus.startupTime,
        environment: env.NODE_ENV,
        squareConfigured: Boolean(env.SQUARE_ACCESS_TOKEN)
      }
    });
  } catch (error) {
    console.error('Failed to log system startup:', error);
  }
})();

export function getSystemStatus(): SystemStatus {
  return systemStatus;
}

export async function logCheckIn(customerName: string, success: boolean): Promise<void> {
  // Update in-memory status
  systemStatus.lastCheckIn = {
    timestamp: new Date().toISOString(),
    customerName,
    success
  };
  
  // Log to database
  await createSystemLog({
    message: `Check-in ${success ? 'successful' : 'failed'} for ${customerName}`,
    eventType: 'check_in',
    severity: success ? 'info' : 'warning',
    details: {
      customerName,
      success,
      timestamp: new Date().toISOString()
    }
  });
}

export async function logSystemError(error: Error, source: string): Promise<void> {
  // Update in-memory status
  systemStatus.lastError = {
    timestamp: new Date().toISOString(),
    message: error.message
  };
  
  // Log to database
  await createSystemLog({
    message: `System error in ${source}: ${error.message}`,
    eventType: 'system_error',
    severity: 'error',
    details: {
      source,
      errorName: error.name,
      errorStack: error.stack,
      timestamp: new Date().toISOString()
    }
  });
}

export function resetSystemStatus(): void {
  systemStatus.squareApiStatus = 'not_configured';
  systemStatus.lastError = null;
  systemStatus.lastCheckIn = null;
  systemStatus.startupTime = new Date().toISOString();
}

export async function updateSquareApiStatus(status: 'connected' | 'error' | 'not_configured'): Promise<void> {
  const oldStatus = systemStatus.squareApiStatus;
  systemStatus.squareApiStatus = status;
  
  // Log status change to database
  if (oldStatus !== status) {
    await createSystemLog({
      message: `Square API status changed from ${oldStatus} to ${status}`,
      eventType: 'square_api_status',
      severity: status === 'error' ? 'error' : 'info',
      details: {
        oldStatus,
        newStatus: status,
        timestamp: new Date().toISOString()
      }
    });
  }
}

export async function getCheckInSystemStatus(): Promise<any> {
  // Get the latest check-in from the database
  const { logs } = await getSystemLogs({
    page: 1,
    limit: 1,
    eventType: 'check_in'
  });
  
  const lastCheckIn = logs.length > 0 ? logs[0] : null;
  
  return {
    status: 'ok',
    url: 'https://rfitness.example.com/check-in',
    lastChecked: new Date().toISOString(),
    lastCheckIn: lastCheckIn ? {
      timestamp: lastCheckIn.timestamp.toISOString(),
      customerName: lastCheckIn.details?.customerName || 'Unknown',
      success: lastCheckIn.details?.success || false
    } : null
  };
}

export async function getRecentActivity(): Promise<any> {
  // Get check-in stats
  const checkInStats = await getCheckInStats();
  
  // Get customer stats
  const customerStats = await getCustomerStats();
  
  // Get recent system logs
  const { logs } = await getSystemLogs({
    page: 1,
    limit: 10,
    eventType: 'check_in'
  });
  
  // Get recent error logs
  const { logs: errorLogs } = await getSystemLogs({
    page: 1,
    limit: 5,
    severity: 'error'
  });
  
  // Transform logs to activity items
  const recentLogs = logs.map((log: any) => ({
    id: log.id.toString(),
    timestamp: log.timestamp.toISOString(),
    message: log.message,
    type: log.eventType,
    details: log.details
  }));
  
  // Transform error logs
  const recentErrors = errorLogs.map((log: any) => ({
    id: log.id.toString(),
    timestamp: log.timestamp.toISOString(),
    message: log.message,
    type: log.eventType,
    details: log.details
  }));
  
  return {
    totalCheckIns: checkInStats.total,
    activeMembers: customerStats.activeCustomers,
    todayCheckIns: checkInStats.today,
    lastUpdated: new Date().toISOString(),
    recentLogs,
    recentErrors
  };
}

