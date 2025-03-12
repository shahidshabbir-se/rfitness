export interface SquareConfig {
  accessToken: string;
  environment: 'sandbox' | 'production';
}

export interface CustomerData {
  id: string;
  name: string;
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

export interface Member {
  id: string;
  name: string;
  phoneNumber: string;
  membershipType: string;
  status: string;
  nextPayment: string;
  lastCheckIn: string;
  visitsThisMonth: number;
  initials: string;
}

export interface AnalyticsData {
  totalCheckIns: number;
  activeMembers: number;
  needsRenewal: number;
  peakHours: Array<{ hour: string; count: number }>;
  topMembers: Array<{ name: string; checkIns: number }>;
  checkInsByDay: Array<{ date: string; count: number }>;
  membershipTypes: Array<{ type: string; count: number }>;
}

export interface SystemStatusData {
  status: string;
  url: string;
  lastChecked: string;
  lastCheckIn?: {
    timestamp: string;
    customerName: string;
    success: boolean;
  } | null;
}

export interface WebhookStatusData {
  status: string;
  message: string;
  lastReceived: string | null;
  signatureValid: boolean;
}

export interface RecentActivityData {
  totalCheckIns: number;
  activeMembers: number;
  todayCheckIns: number;
  lastUpdated: string;
  recentLogs?: Array<{
    id: string;
    timestamp: string;
    message: string;
    type: string;
    details: any;
  }>;
}

// Database Models
export interface User {
  id: number;
  name: string;
  password: string;
  email: string;
  role: 'admin' | 'staff';
  createdAt: Date;
  lastLogin: Date | null;
}

export interface CheckIn {
  id: number;
  customerId: string;
  customerName: string | null;
  phoneNumber: string | null;
  checkInTime: Date;
  membershipType: string | null;
  locationId: string | null;
  verifiedBy: string | null;
}

export interface SystemLog {
  id: number;
  timestamp: Date;
  eventType: string;
  message: string;
  details: any;
  severity: 'info' | 'warning' | 'error';
}

export interface Configuration {
  key: string;
  value: any;
  description: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

// SSE-related types
export interface SSEEvent {
  event: string;
  data: any;
}

export interface CheckInEventData extends CheckInRecord {
  // Additional fields specific to check-in events can be added here
}
