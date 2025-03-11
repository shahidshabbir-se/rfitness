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
