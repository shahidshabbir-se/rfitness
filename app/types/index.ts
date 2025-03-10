export interface SquareConfig {
  accessToken: string;
  environment: 'sandbox' | 'production';
}

export interface CustomerData {
  id?: string;
  name?: string;
  phoneNumber?: string;
  email?: string;
  membershipStatus?: string;
  expirationDate?: string;
  paymentStatus?: string;
}

export interface CheckInResult {
  success: boolean;
  message: string;
  error?: string;
  customerData?: CustomerData;
}

export interface SystemStatusData {
  squareApiStatus: 'connected' | 'error' | 'not_configured';
  environment: string;
  lastError?: {
    timestamp: string;
    message: string;
  };
  lastCheckIn?: {
    timestamp: string;
    customerName: string;
    success: boolean;
  };
  uptime: string;
}

/**
 * Check-in record type for real-time notifications
 */
export interface CheckInRecord {
  id: string;
  timestamp: string;
  customerName: string;
  phoneNumber: string;
  success: boolean;
  membershipType: string;
  message: string;
  nextPayment: string;
  initials: string;
}

/**
 * Webhook status type
 */
export interface WebhookStatus {
  status: 'healthy' | 'warning' | 'error';
  message: string;
  lastReceived: string | null;
  signatureValid: boolean;
}

/**
 * Member type
 */
export interface Member {
  id: string;
  name: string;
  phoneNumber: string;
  membershipType: string;
  status: 'Active' | 'Inactive' | 'Pending';
  nextPayment: string;
  lastCheckIn: string;
  visitsThisMonth: number;
  initials: string;
}

/**
 * System status type
 */
export interface SystemStatus {
  status: {
    squareApiStatus: 'connected' | 'error' | 'not_configured';
    environment: string;
    uptime: string;
    lastError?: {
      timestamp: string;
      message: string;
    } | null;
    lastCheckIn?: {
      timestamp: string;
      customerName: string;
      success: boolean;
    } | null;
  };
  url: string;
  lastChecked: string;
}

/**
 * Analytics data type
 */
export interface AnalyticsData {
  totalCheckIns: number;
  activeMembers: number;
  needsRenewal: number;
  peakHours: Array<{ hour: string; count: number }>;
  topMembers: Array<{ name: string; checkIns: number }>;
  checkInsByDay: Array<{ date: string; count: number }>;
  membershipTypes: Array<{ type: string; count: number }>;
}

/**
 * Webhook event type
 */
export type WebhookEvent = 'check-in' | 'membership-update' | 'payment-received';
