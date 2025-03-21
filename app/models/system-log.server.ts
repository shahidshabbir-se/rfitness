import { prisma } from '~/utils/db.utils';

// Define types based on the schema
type LogSeverity = 'info' | 'warning' | 'error' | 'debug';

interface SystemLog {
  id: number;
  timestamp: Date;
  eventType: string;
  message: string;
  details: string | null;
  severity: string;
}

/**
 * Create a new system log entry
 */
export async function createSystemLog({
  message,
  eventType,
  severity = 'info',
  details
}: {
  message: string;
  eventType: string;
  severity?: LogSeverity;
  details?: Record<string, any>;
}) {
  return prisma.systemLog.create({
    data: {
      message,
      eventType,
      severity,
      details: details ? details : null,
      timestamp: new Date()
    }
  });
}

/**
 * Get recent system logs with pagination
 */
export async function getSystemLogs({
  page = 1,
  limit = 50,
  severity,
  eventType,
  startDate,
  endDate,
  after
}: {
  page?: number;
  limit?: number;
  severity?: LogSeverity;
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  after?: Date;
} = {}) {
  const skip = (page - 1) * limit;
  
  // Build where clause based on filters
  const where: any = {};
  
  if (severity) {
    where.severity = severity;
  }
  
  if (eventType) {
    where.eventType = eventType;
  }
  
  if (startDate || endDate || after) {
    where.timestamp = {};
    
    if (startDate) {
      where.timestamp.gte = startDate;
    }
    
    if (after) {
      if (!where.timestamp.gte || after > where.timestamp.gte) {
        where.timestamp.gte = after;
      }
    }
    
    if (endDate) {
      where.timestamp.lte = endDate;
    }
  }
  
  const [logs, total] = await Promise.all([
    prisma.systemLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { timestamp: 'desc' }
    }),
    prisma.systemLog.count({ where })
  ]);
  
  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get log event types for filtering
 */
export async function getLogEventTypes() {
  const eventTypes = await prisma.systemLog.groupBy({
    by: ['eventType'],
    _count: {
      id: true
    }
  });
  
  return eventTypes.map((item: { eventType: string; _count: { id: number } }) => ({
    eventType: item.eventType,
    count: item._count.id
  }));
}

/**
 * Delete logs older than a certain date
 */
export async function purgeOldLogs(olderThan: Date) {
  return prisma.systemLog.deleteMany({
    where: {
      timestamp: {
        lt: olderThan
      }
    }
  });
}

/**
 * Log a system error with stack trace
 */
export async function logError(error: Error, eventType: string = 'system_error') {
  return createSystemLog({
    message: error.message,
    eventType,
    severity: 'error',
    details: {
      stack: error.stack,
      name: error.name
    }
  });
} 