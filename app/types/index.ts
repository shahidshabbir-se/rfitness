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
