export interface Customer {
  id: string;
  createdAt: string;
  updatedAt: string;
  cards: object[];
  givenName: string;
  familyName: string;
  emailAddress: string;
  phoneNumber: string;
  preferences: {
    emailUnsubscribed: boolean;
  };
  creationSource: string;
  segmentIds: string[];
  version: bigint;
}

export interface SortedCustomers {
  customerId: string;
  nextPaymentDate: string;
  membershipStatus: string;
}

export interface Subscription {
  customerId: string;
  chargedThroughDate: string;
  status: string;
}

interface AmountMoney {
  amount: bigint;
  currency: string;
}

interface CardDetails {
  status: string;
  card: object;  // You can define a more specific type here if needed
  entryMethod: string;
  cvvStatus: string;
  avsStatus: string;
  authResultCode: string;
  applicationIdentifier: string;
  applicationName: string;
  applicationCryptogram: string;
  verificationMethod: string;
  verificationResults: string;
  statementDescription: string;
  deviceDetails: object;
  cardPaymentTimeline: object;
}

interface DeviceDetails {
  deviceId: string;
  deviceInstallationId: string;
  deviceName: string;
}

export interface Payment {
  id: string;
  createdAt: string;
  updatedAt: string;
  amountMoney?: AmountMoney;
  totalMoney?: AmountMoney;
  approvedMoney?: AmountMoney;
  processingFee?: object[];  // You can define the structure of the fee if needed
  status: string;
  delayDuration?: string;
  delayAction?: string;
  delayedUntil?: string;
  sourceType: string;
  cardDetails?: CardDetails;
  locationId: string;
  orderId: string;
  customerId: string;
  employeeId: string;
  teamMemberId: string;
  receiptNumber: string;
  receiptUrl: string;
  deviceDetails: DeviceDetails;
  applicationDetails: object;
  versionToken: string;
}
