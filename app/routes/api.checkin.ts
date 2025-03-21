import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getEnv } from "~/utils/env.server";
import type {
  CheckInRecord,
  WebhookStatusData,
  Member,
  SystemStatusData,
  AnalyticsData,
  RecentActivityData,
} from "~/types";
import { getWebhookStatus } from "~/utils/webhook.server";
import { requireAdmin } from "~/utils/session.server";
import {
  getCheckInSystemStatus,
  getRecentActivity,
} from "~/utils/system.server";
import { getMembersNeedingRenewal } from "~/utils/square.server";
import { prisma } from "~/utils/db.utils";

// Import database models
import {
  getRecentCheckIns,
  getCheckInStats,
  getCheckInPeakHours,
  getCheckInsByDayOfWeek,
} from "~/models/check-in.server";
import {
  getAllCustomers,
  getCustomerStats,
  getMemberMetrics,
  syncCustomersWithPrisma,
} from "~/models/customer.server";
import { getSystemLogs } from "~/models/system-log.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Require admin authentication
  await requireAdmin(request);

  try {
    const env = getEnv();

    // Get time range from URL if provided
    const url = new URL(request.url);
    const timeRange = (url.searchParams.get("timeRange") || "week") as
      | "week"
      | "month"
      | "quarter";

    // Check if this is a recent-events request
    const since = url.searchParams.get("since");
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const isRecentEventsRequest = url.searchParams.has("since");

    if (isRecentEventsRequest) {
      // This is a request for recent events (polling)
      // Parse the since timestamp or use a recent default
      let sinceDate: Date;
      if (since) {
        sinceDate = new Date(since);
        // If invalid date, use default
        if (isNaN(sinceDate.getTime())) {
          sinceDate = new Date();
          sinceDate.setMinutes(sinceDate.getMinutes() - 5); // Last 5 minutes
        }
      } else {
        sinceDate = new Date();
        sinceDate.setMinutes(sinceDate.getMinutes() - 5); // Last 5 minutes
      }

      // Get recent check-ins from database
      const checkInsData = await getRecentCheckIns(1, limit);

      // Get recent system logs for customer and subscription updates
      const { logs: customerLogs } = await getSystemLogs({
        page: 1,
        limit,
        eventType: "customer_webhook",
        after: sinceDate,
      });

      const { logs: subscriptionLogs } = await getSystemLogs({
        page: 1,
        limit,
        eventType: "subscription_webhook",
        after: sinceDate,
      });

      // Transform check-ins to the expected format
      const checkInRecords: CheckInRecord[] = checkInsData.checkIns
        .filter((checkIn: any) => new Date(checkIn.checkInTime) > sinceDate)
        .map((checkIn: any) => ({
          id: checkIn.id.toString(),
          timestamp: checkIn.checkInTime.toISOString(),
          customerName:
            checkIn.customerName || checkIn.customer?.name || "Unknown",
          phoneNumber:
            checkIn.phoneNumber || checkIn.customer?.phoneNumber || "",
          success: true, // All stored check-ins are successful
          membershipType:
            checkIn.membershipType ||
            checkIn.customer?.membershipType ||
            "Unknown",
          message: "Check-in successful",
          nextPayment: "", // We don't have this information yet
          initials: (
            checkIn.customerName ||
            checkIn.customer?.name ||
            "Unknown"
          )
            .split(" ")
            .map((name: string) => name[0])
            .join("")
            .substring(0, 2),
        }));

      // Transform customer logs to the expected format
      const customerEvents = customerLogs.map((log: any) => ({
        id: `customer-update-${log.id}`,
        timestamp: log.timestamp.toISOString(),
        customerName: log.details?.customerName || "Customer",
        phoneNumber: log.details?.phoneNumber || "",
        success: true,
        membershipType: "Update",
        message: `Customer ${log.details?.eventType?.split(".")?.[1] || "updated"}: ${log.details?.customerName || "Unknown"}`,
        nextPayment: "",
        initials: log.details?.customerName
          ? log.details.customerName
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .substring(0, 2)
          : "CU",
        eventType: "customer-update",
      }));

      // Transform subscription logs to the expected format
      const subscriptionEvents = subscriptionLogs.map((log: any) => ({
        id: `subscription-update-${log.id}`,
        timestamp: log.timestamp.toISOString(),
        customerName: "Subscription Update",
        phoneNumber: log.details?.customerId || "",
        success: log.details?.status === "ACTIVE",
        membershipType: "Subscription",
        message: `Subscription ${log.details?.eventType?.split(".")?.[1] || "updated"}: ${log.details?.status || "Unknown"}`,
        nextPayment: "",
        initials: "SU",
        eventType: "subscription-update",
      }));

      // Combine all events and sort by timestamp (newest first)
      const allEvents = [
        ...checkInRecords,
        ...customerEvents,
        ...subscriptionEvents,
      ].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Get webhook status for the response
      const webhookStatus: WebhookStatusData = getWebhookStatus();

      // Get check-in system status
      const systemStatus: SystemStatusData = await getCheckInSystemStatus();

      return json({
        events: allEvents,
        timestamp: new Date().toISOString(),
        webhookStatus,
        systemStatus,
        checkIns: [],
        members: [],
        analytics: {
          totalCheckIns: 0,
          activeMembers: 0,
          needsRenewal: 0,
          peakHours: [],
          topMembers: [],
          checkInsByDay: [],
          membershipTypes: [],
        },
        recentActivity: {
          totalCheckIns: 0,
          activeMembers: 0,
          todayCheckIns: 0,
          lastUpdated: new Date().toISOString(),
          recentLogs: [],
        },
        timeRange: "week",
        memberMetrics: {
          newMembers: 0,
          retentionRate: 0,
          newMembersChange: "0%",
          retentionChange: "0%",
        },
        membersNeedingRenewal: [],
        needsRenewalCount: 0,
      });
    }

    // Regular admin dashboard request
    // Get real webhook status
    const webhookStatus: WebhookStatusData = getWebhookStatus();

    // Get check-in system status
    const systemStatus: SystemStatusData = await getCheckInSystemStatus();

    // Get real data from database
    const checkInsData = await getRecentCheckIns(1, 50);
    const checkInStats = await getCheckInStats();

    syncCustomersWithPrisma();

    // Get customer data
    const customersData = await getAllCustomers(1, 100);
    const customerStats = await getCustomerStats();

    // Get analytics data
    const peakHours = await getCheckInPeakHours(timeRange);
    const checkInsByDay = await getCheckInsByDayOfWeek(timeRange);
    const memberMetrics = await getMemberMetrics(timeRange);

    // Get recent system logs for activity
    const { logs: recentLogs } = await getSystemLogs({
      page: 1,
      limit: 20,
      eventType: "check_in",
    });

    // Transform database data to match expected formats
    const checkIns: CheckInRecord[] = checkInsData.checkIns.map(
      (checkIn: any) => ({
        id: checkIn.id.toString(),
        timestamp: checkIn.checkInTime.toISOString(),
        customerName: checkIn.customerName || checkIn.customer.name,
        phoneNumber: checkIn.phoneNumber || checkIn.customer.phoneNumber || "",
        success: true, // All stored check-ins are successful
        membershipType:
          checkIn.membershipType ||
          checkIn.customer.membershipType ||
          "Unknown",
        message: "Check-in successful",
        nextPayment: "", // We don't have this information yet
        initials: (checkIn.customerName || checkIn.customer.name)
          .split(" ")
          .map((name: string) => name[0])
          .join("")
          .substring(0, 2),
      })
    );

    const members: Member[] = await Promise.all(
      customersData.customers.map(async (customer: any) => {
        // Find the most recent check-in for this customer via prisma
        const lastCheckIn = await prisma.CheckIn.findFirst({
          where: { customerId: customer.id },
          orderBy: { checkInTime: "desc" },
          select: { checkInTime: true },
        });

        // Calculate visits this month
        const visitsThisMonth = customer._count?.checkIns || 0;

        const subscriptionMethod = customer.subscription?.subscriptionMethod;
        const cashPayment = customer.cashPayment?.paymentDate;

        // Determine status based on membershipType
        const today = new Date(); // Get today's date
        const nextPaymentDate = customer.nextPayment
          ? new Date(customer.nextPayment)
          : null;

        // Check conditions
        const status =
          (customer.membershipType === "Subscription Based" ||
            customer.membershipType === "Cash Payment Based") &&
          nextPaymentDate &&
          nextPaymentDate >= today
            ? "Active"
            : "";

        const lastCheckInFormatted = lastCheckIn?.checkInTime
          ? new Date(lastCheckIn.checkInTime).toLocaleDateString()
          : "Never";
        return {
          id: customer.id,
          name: customer.name,
          phoneNumber: customer.phoneNumber || "",
          membershipType: customer.membershipType || "Unknown",
          status: status, // Use the determined status instead of hardcoding
          nextPayment: customer.nextPayment, // We don't have this information yet
          lastCheckIn: lastCheckInFormatted,
          visitsThisMonth,
          initials: customer.name
            .split(" ")
            .map((name: string) => name[0])
            .join("")
            .substring(0, 2),
        };
      })
    );

    // Create analytics data from our stats
    const analytics: AnalyticsData = {
      totalCheckIns: checkInStats.total,
      activeMembers: customerStats.activeCustomers,
      needsRenewal: 0, // We don't have this information yet

      // Use real peak hours data
      peakHours: peakHours || [],

      // Get top members by check-in count
      topMembers: members
        .sort((a, b) => b.visitsThisMonth - a.visitsThisMonth)
        .slice(0, 5)
        .map((member) => ({
          name: member.name,
          checkIns: member.visitsThisMonth,
        })),

      // Use real check-ins by day data
      checkInsByDay: checkInsByDay || [],

      // Use real membership type data
      membershipTypes: customerStats.membershipTypes
        ? customerStats.membershipTypes.map((type: any) => ({
            type: type.type || "Unknown",
            count: type.count || 0,
          }))
        : [],
    };

    // Get recent activity
    const recentActivity: RecentActivityData = await getRecentActivity();

    // Get members needing renewal
    const membersNeedingRenewalData = await getMembersNeedingRenewal();

    return json(
      JSON.parse(
        JSON.stringify(
          {
            checkIns,
            members,
            analytics,
            systemStatus,
            webhookStatus,
            recentActivity,
            timeRange,
            memberMetrics,
            membersNeedingRenewal: membersNeedingRenewalData.members,
            needsRenewalCount: membersNeedingRenewalData.count,
          },
          (_, value) => (typeof value === "bigint" ? value.toString() : value) // Convert BigInt to string
        )
      )
    );
  } catch (error) {
    console.error("Error loading admin data:", error);
    return json(
      {
        error: "Failed to load admin data",
        message: error instanceof Error ? error.message : "Unknown error",
        checkIns: [],
        members: [],
        analytics: {
          totalCheckIns: 0,
          activeMembers: 0,
          needsRenewal: 0,
          peakHours: [],
          topMembers: [],
          checkInsByDay: [],
          membershipTypes: [],
        },
        systemStatus: {
          status: "error",
          url: "",
          lastChecked: new Date().toISOString(),
          lastCheckIn: null,
        },
        webhookStatus: {
          status: "error",
          message: "Error loading webhook status",
          lastReceived: null,
          signatureValid: false,
        },
        recentActivity: {
          totalCheckIns: 0,
          activeMembers: 0,
          todayCheckIns: 0,
          lastUpdated: new Date().toISOString(),
          recentLogs: [],
        },
        timeRange: "week",
        memberMetrics: {
          newMembers: 0,
          retentionRate: 0,
          newMembersChange: "0%",
          retentionChange: "0%",
        },
        membersNeedingRenewal: [],
        needsRenewalCount: 0,
      },
      { status: 500 }
    );
  }
}
