// System status tracking
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

export function getSystemStatus(): SystemStatus {
  return systemStatus;
}

export function logCheckIn(customerName: string, success: boolean): void {
  systemStatus.lastCheckIn = {
    timestamp: new Date().toISOString(),
    customerName,
    success
  };
}

export function resetSystemStatus(): void {
  systemStatus.squareApiStatus = 'not_configured';
  systemStatus.lastError = null;
  systemStatus.lastCheckIn = null;
  systemStatus.startupTime = new Date().toISOString();
}

// remove the below section after deployment check
export async function getCheckInSystemStatus(): Promise<string> {
  // Your logic to check system status
  return 'ok'; // Example response
}

export async function getRecentActivity(): Promise<any[]> {
  // Example: Fetch recent activity from the database
  return [];
}

