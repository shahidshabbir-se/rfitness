/**
 * Environment variables for the application
 */
type Env = {
  NODE_ENV: 'development' | 'production' | 'test';
  SQUARE_ACCESS_TOKEN?: string;
  SQUARE_LOCATION_ID?: string;
  SQUARE_ENVIRONMENT?: 'sandbox' | 'production';
  SQUARE_WEBHOOK_SIGNATURE_KEY?: string;
  SQUARE_WEBHOOK_URL?: string;
  DATABASE_URL: string;
  SESSION_SECRET: string;
};

export function getEnv(): Env {
  return {
    NODE_ENV: process.env.NODE_ENV as 'development' | 'production' | 'test',
    SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN,
    SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID,
    SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT as 'sandbox' | 'production',
    SQUARE_WEBHOOK_SIGNATURE_KEY: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY,
    SQUARE_WEBHOOK_URL: process.env.SQUARE_WEBHOOK_URL,
    DATABASE_URL: process.env.DATABASE_URL as string,
    SESSION_SECRET: process.env.SESSION_SECRET as string,
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
export function isSquareConfigured(): boolean {
  const { SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID } = getEnv();
  return Boolean(SQUARE_ACCESS_TOKEN && SQUARE_LOCATION_ID);
}

export function isWebhookConfigured(): boolean {
  const { SQUARE_WEBHOOK_SIGNATURE_KEY, SQUARE_WEBHOOK_URL } = getEnv();
  return Boolean(SQUARE_WEBHOOK_SIGNATURE_KEY && SQUARE_WEBHOOK_URL);
}
