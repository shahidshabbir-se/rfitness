import { prisma } from '~/utils/db.utils';

/**
 * Get a configuration value by key
 */
export async function getConfigurationByKey(key: string) {
  const config = await prisma.configuration.findUnique({
    where: { key },
    include: {
      updatedUser: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
  
  return config;
}

/**
 * Get all configurations
 */
export async function getAllConfigurations() {
  return prisma.configuration.findMany({
    include: {
      updatedUser: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      key: 'asc'
    }
  });
}

/**
 * Update or create a configuration
 */
export async function upsertConfiguration({
  key,
  value,
  description,
  updatedBy
}: {
  key: string;
  value: any;
  description?: string;
  updatedBy?: number;
}) {
  return prisma.configuration.upsert({
    where: { key },
    update: {
      value,
      description,
      updatedBy
    },
    create: {
      key,
      value,
      description,
      updatedBy
    }
  });
}

/**
 * Delete a configuration
 */
export async function deleteConfiguration(key: string) {
  return prisma.configuration.delete({
    where: { key }
  });
}

/**
 * Get Square API configuration
 */
export async function getSquareConfig() {
  const config = await getConfigurationByKey('square_api');
  
  if (!config) {
    return null;
  }
  
  return {
    enabled: config.value.enabled || false,
    environment: config.value.environment || 'sandbox',
    accessToken: config.value.accessToken || '',
    locationId: config.value.locationId || '',
    webhookSignatureKey: config.value.webhookSignatureKey || ''
  };
}

/**
 * Update Square API configuration
 */
export async function updateSquareConfig({
  enabled,
  environment,
  accessToken,
  locationId,
  webhookSignatureKey,
  updatedBy
}: {
  enabled: boolean;
  environment: 'sandbox' | 'production';
  accessToken: string;
  locationId: string;
  webhookSignatureKey: string;
  updatedBy?: number;
}) {
  return upsertConfiguration({
    key: 'square_api',
    value: {
      enabled,
      environment,
      accessToken,
      locationId,
      webhookSignatureKey
    },
    description: 'Square API configuration',
    updatedBy
  });
}

/**
 * Get system settings
 */
export async function getSystemSettings() {
  const config = await getConfigurationByKey('system_settings');
  
  if (!config) {
    return {
      gymName: 'R-Fitness',
      checkInExpiryHours: 2,
      logRetentionDays: 30,
      allowGuestCheckIn: false
    };
  }
  
  return {
    gymName: config.value.gymName || 'R-Fitness',
    checkInExpiryHours: config.value.checkInExpiryHours || 2,
    logRetentionDays: config.value.logRetentionDays || 30,
    allowGuestCheckIn: config.value.allowGuestCheckIn || false
  };
}

/**
 * Update system settings
 */
export async function updateSystemSettings({
  gymName,
  checkInExpiryHours,
  logRetentionDays,
  allowGuestCheckIn,
  updatedBy
}: {
  gymName: string;
  checkInExpiryHours: number;
  logRetentionDays: number;
  allowGuestCheckIn: boolean;
  updatedBy?: number;
}) {
  return upsertConfiguration({
    key: 'system_settings',
    value: {
      gymName,
      checkInExpiryHours,
      logRetentionDays,
      allowGuestCheckIn
    },
    description: 'System settings',
    updatedBy
  });
} 