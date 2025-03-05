/**
 * Environment variables for the application
 */
export function getEnv() {
  return {
    SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN || '',
    SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT || 'sandbox',
    SQUARE_WEBHOOK_SIGNATURE_KEY: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '',
    SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID || '',
    NODE_ENV: process.env.NODE_ENV || 'development',
  };
}

/**
 * Check if the application is running in development mode
 */
export function isDevelopment() {
  return getEnv().NODE_ENV === 'development';
}

/**
 * Check if Square API is configured
 */
export function isSquareConfigured() {
  const env = getEnv();
  return Boolean(env.SQUARE_ACCESS_TOKEN && env.SQUARE_ACCESS_TOKEN.length > 0);
}
