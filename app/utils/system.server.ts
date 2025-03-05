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
