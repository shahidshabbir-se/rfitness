// System status tracking
import { createSystemLog, getSystemLogs } from "~/models/system-log.server";
import { getCheckInStats } from "~/models/check-in.server";
import { getCustomerStats } from "~/models/customer.server";
import { getEnv } from "./env.server";
import { prisma } from "~/utils/db.utils";

type SystemStatus = {
  squareApiStatus: "connected" | "error" | "not_configured";
  lastError: {
    timestamp: string;
    message: string;
  } | null;
  lastCheckIn: {
    timestamp: string;
    customerName: string;
    success: boolean;
  } | null;
  startupTime: string;
};

// Initialize system status
const systemStatus: SystemStatus = {
  squareApiStatus: "not_configured",
  lastError: null,
  lastCheckIn: null,
  startupTime: new Date().toISOString(),
};

// Log system startup
(async () => {
  try {
    const env = getEnv();
    await createSystemLog({
      message: "System started",
      eventType: "system_startup",
      severity: "info",
      details: {
        startupTime: systemStatus.startupTime,
        environment: env.NODE_ENV,
        squareConfigured: Boolean(env.SQUARE_ACCESS_TOKEN),
      },
    });
  } catch (error) {
    console.error("Failed to log system startup:", error);
  }
})();

export function getSystemStatus(): SystemStatus {
  return systemStatus;
}

export async function logCheckIn(
  customerName: string,
  success: boolean
): Promise<void> {
  // Update in-memory status
  systemStatus.lastCheckIn = {
    timestamp: new Date().toISOString(),
    customerName,
    success,
  };

  // Log to database
  await createSystemLog({
    message: `Check-in ${success ? "successful" : "failed"} for ${customerName}`,
    eventType: "check_in",
    severity: success ? "info" : "warning",
    details: {
      customerName,
      success,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function logSystemError(
  error: Error,
  source: string
): Promise<void> {
  // Update in-memory status
  systemStatus.lastError = {
    timestamp: new Date().toISOString(),
    message: error.message,
  };

  // Log to database
  await createSystemLog({
    message: `System error in ${source}: ${error.message}`,
    eventType: "system_error",
    severity: "error",
    details: {
      source,
      errorName: error.name,
      errorStack: error.stack,
      timestamp: new Date().toISOString(),
    },
  });
}

export function resetSystemStatus(): void {
  systemStatus.squareApiStatus = "not_configured";
  systemStatus.lastError = null;
  systemStatus.lastCheckIn = null;
  systemStatus.startupTime = new Date().toISOString();
}

export async function updateSquareApiStatus(
  status: "connected" | "error" | "not_configured"
): Promise<void> {
  const oldStatus = systemStatus.squareApiStatus;
  systemStatus.squareApiStatus = status;

  // Log status change to database
  if (oldStatus !== status) {
    await createSystemLog({
      message: `Square API status changed from ${oldStatus} to ${status}`,
      eventType: "square_api_status",
      severity: status === "error" ? "error" : "info",
      details: {
        oldStatus,
        newStatus: status,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

export async function getCheckInSystemStatus(): Promise<any> {
  // Get the latest check-in from the database
  const { logs } = await getSystemLogs({
    page: 1,
    limit: 1,
    eventType: "check_in",
  });

  const lastCheckIn = logs.length > 0 ? logs[0] : null;

  return {
    status: "ok",
    url: "https://rfitness.example.com/check-in",
    lastChecked: new Date().toISOString(),
    lastCheckIn: lastCheckIn
      ? {
          timestamp: lastCheckIn.timestamp.toISOString(),
          customerName: lastCheckIn.details?.customerName || "Unknown",
          success: lastCheckIn.details?.success || false,
        }
      : null,
  };
}

export async function getRecentActivity(): Promise<any> {
  try {
    // Fetch check-in and customer stats concurrently
    const [checkInStats, customerStats] = await Promise.all([
      getCheckInStats(),
      getCustomerStats(),
    ]);

    // Fetch recent check-in logs and error logs concurrently
    const [{ logs: checkInLogs }, { logs: errorLogs }] = await Promise.all([
      getSystemLogs({ page: 1, limit: 10, eventType: "check_in" }),
      getSystemLogs({ page: 1, limit: 5, severity: "error" }),
    ]);

    // Extract unique customer IDs from logs
    const customerIds = checkInLogs
      .map((log: any) => log.details?.customerId)
      .filter((id: string | undefined) => id !== undefined);

    // Fetch customer details in bulk
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true },
    });

    // Create a lookup map for customer details
    const customerMap = new Map(
      customers.map((customer) => [customer.id, customer.name])
    );

    // Format recent check-in logs with customer names
    const recentLogs = checkInLogs.map((log: any) => {
      const customerId = log.details?.customerId;
      const customerName = customerId
        ? customerMap.get(customerId) || "Unknown"
        : "Unknown";

      return {
        id: log.id.toString(),
        timestamp: new Date(log.timestamp).toISOString(),
        message: log.message || `Check-in recorded for ${customerName}`,
        type: log.eventType,
        customerName,
        initials:
          customerName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase() || "?",
        details: log.details || {},
      };
    });

    // Format recent error logs
    const recentErrors = errorLogs.map((log: any) => ({
      id: log.id.toString(),
      timestamp: new Date(log.timestamp).toISOString(),
      message: log.message || "No error message",
      type: log.eventType,
      details: log.details || {},
    }));

    return {
      totalCheckIns: checkInStats.total,
      activeMembers: customerStats.activeCustomers,
      todayCheckIns: checkInStats.today,
      lastUpdated: new Date().toISOString(),
      recentLogs,
      recentErrors,
    };
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    return {
      totalCheckIns: 0,
      activeMembers: 0,
      todayCheckIns: 0,
      lastUpdated: new Date().toISOString(),
      recentLogs: [],
      recentErrors: [],
    };
  }
}
