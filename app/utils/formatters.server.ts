/**
 * Formats customer data from Square API response
 */
export function formatCustomerData(customer: any, additionalData: any) {
  // Extract first and last name
  const firstName = customer.givenName || '';
  const lastName = customer.familyName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  
  // Generate initials
  const initials = firstName && lastName 
    ? `${firstName.charAt(0)}${lastName.charAt(0)}`
    : firstName
      ? firstName.charAt(0)
      : 'U'; // Default to 'U' for unknown
  
  return {
    id: customer.id,
    name: fullName || 'Unknown Customer',
    phoneNumber: customer.phoneNumber || '',
    membershipType: additionalData.membershipStatus === 'Active' 
      ? 'Monthly Subscription (£25)' 
      : 'None',
    membershipStatus: additionalData.membershipStatus || 'Unknown',
    expirationDate: additionalData.expirationDate,
    paymentStatus: additionalData.paymentStatus || 'Unknown',
    nextPayment: additionalData.expirationDate 
      ? new Date(additionalData.expirationDate).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
      : undefined,
    initials
  };
}

/**
 * Formats a date for display
 */
export function formatDate(date: Date | string): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Format a phone number for display
 */
export function formatPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) return '';
  
  // For UK numbers, format as +44 7XXX XXXXXX
  if (phoneNumber.startsWith('+44')) {
    const cleaned = phoneNumber.replace(/\D/g, '');
    const match = cleaned.match(/^(44)(\d{3})(\d{3})(\d{4})$/);
    
    if (match) {
      return `+${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
    }
  }
  
  // Return as-is if we can't format it
  return phoneNumber;
}

/**
 * Format a phone number for Square API (E.164 format)
 */
export function formatPhoneNumberForApi(phoneNumber: string): string {
  if (!phoneNumber) return '';
  
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // If it's a UK number starting with 0, convert to +44
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return '+44' + cleaned.substring(1);
  }
  
  // If it already has the country code (44) but no +, add it
  if (cleaned.startsWith('44') && cleaned.length === 12) {
    return '+' + cleaned;
  }
  
  // If it already has a +, return as is
  if (phoneNumber.startsWith('+')) {
    return phoneNumber;
  }
  
  // Default: assume it's a UK number and add +44
  return '+44' + cleaned;
}
