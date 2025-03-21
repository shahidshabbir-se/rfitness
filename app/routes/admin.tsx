import { Link } from "@remix-run/react";
import { useState, useEffect, useCallback } from "react";
import Logo from "~/components/common/Logo";

// Import refactored components
import SystemStatusComponent from "~/components/admin/SystemStatus";
import CheckInSystemStatus from "~/components/admin/CheckInSystemStatus";
import CheckInNotifications from "~/components/admin/CheckInNotifications";
import AdminTabs from "~/components/admin/AdminTabs";
import CheckInLog from "~/components/admin/CheckInLog";
import MembershipStatus from "~/components/admin/MembershipStatus";
import AnalyticsReports from "~/components/admin/AnalyticsReports";
import WebhookStatusComponent from "~/components/admin/WebhookStatus";
import MembersTab from "~/components/admin/MembersTab";
import RecentActivity from "~/components/admin/RecentActivity";

interface CheckInRecord {
  id: string;
  timestamp: string;
  customerName: string;
  phoneNumber: string;
  success: boolean;
  membershipType: string;
  message: string;
  nextPayment: string;
  initials: string;
}

interface Member {
  id: string;
  name: string;
  phoneNumber: string;
  membershipType: string;
  status: string;
  nextPayment: string;
  lastCheckIn: string;
  visitsThisMonth: number;
  initials: string;
}

interface AnalyticsData {
  totalCheckIns: number;
  activeMembers: number;
  needsRenewal: number;
  peakHours: { hour: string; count: number }[];
  topMembers: { name: string; checkIns: number }[];
  checkInsByDay: { date: string; count: number }[];
  membershipTypes: { type: string; count: number }[];
}

interface SystemStatusData {
  status: string;
  url: string;
  lastChecked: string;
  lastCheckIn: { timestamp: string; customerName: string; success: boolean };
}

interface WebhookStatusData {
  status: string;
  message: string;
  lastReceived: string | null;
  signatureValid: boolean;
}

interface RecentActivityData {
  totalCheckIns: number;
  activeMembers: number;
  todayCheckIns: number;
  lastUpdated: string;
  recentLogs: {
    id: string;
    timestamp: string;
    message: string;
    type: string;
    details: {
      id: string;
      message: string;
      success: boolean;
      initials: string;
      timestamp: string;
      customerId: string;
      locationId: string;
      nextPayment: string;
      phoneNumber: string;
      customerName: string;
      membershipType: string;
    };
  }[];
  recentErrors: any[];
}

interface MemberMetrics {
  newMembers: number;
  retentionRate: number;
  newMembersChange: string;
  retentionChange: string;
}

interface AdminResponse {
  checkIns: CheckInRecord[];
  members: Member[];
  analytics: AnalyticsData;
  systemStatus: SystemStatusData;
  webhookStatus: WebhookStatusData;
  recentActivity: RecentActivityData;
  timeRange: string;
  memberMetrics: MemberMetrics;
  membersNeedingRenewal: any[];
  needsRenewalCount: number;
  payments: any[];
  subscriptions: any[];
}

export default function AdminDashboard() {
  const [loaderData, setLoaderData] = useState<AdminResponse | null>(null);
  const [activeTab, setActiveTab] = useState("checkIns");
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [membersNeedingRenewal, setMembersNeedingRenewal] = useState<any[]>([]);
  const [needsRenewalCount, setNeedsRenewalCount] = useState<number>(0);
  const [timeRange, setTimeRange] = useState<
    "week" | "month" | "quarter" | undefined
  >("week");
  const [memberMetrics, setMemberMetrics] = useState<MemberMetrics | null>(
    null
  );
  const [lastCheckInId, setLastCheckInId] = useState<string | null>(null);
  const [checkInNotifications, setCheckInNotifications] = useState<
    CheckInRecord[]
  >([]);
  const [lastRefresh, setLastRefresh] = useState<string>(
    new Date().toISOString()
  );
  const [systemStatus, setSystemStatus] = useState<SystemStatusData | null>(
    null
  );
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatusData | null>(
    null
  );
  const [recentActivity, setRecentActivity] =
    useState<RecentActivityData | null>(null);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/checkin");
      const data = await response.json();
      setLoaderData(data);
      setSystemStatus(data.systemStatus);
      setWebhookStatus(data.webhookStatus);
      setRecentActivity(data.recentActivity);
      setCheckIns(data.checkIns);
      setMembers(data.members);
      setAnalytics(data.analytics);
      setMembersNeedingRenewal(data.membersNeedingRenewal);
      setNeedsRenewalCount(data.needsRenewalCount);
      setTimeRange(data.timeRange);
      setMemberMetrics(data.memberMetrics);
      setLastRefresh(new Date().toISOString());
      if (data.recentActivity?.recentLogs?.length) {
        // Sort by latest first and keep only the latest 5 logs
        const latestLogs = data.recentActivity.recentLogs
          .sort((a: any, b: any) => parseInt(b.id) - parseInt(a.id))
          .slice(0, 5)
          .map((log) => ({
            id: log.id,
            timestamp: log.timestamp,
            message: log.message,
            success: log.details?.success ?? true, // Default to true if missing
            initials: log.customerName
              ? log.customerName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
              : "?", // Default to "?" if initials are missing
            customerName: log.customerName?.trim() || "Unknown", // Default to "Unknown"
          }));

        setCheckInNotifications(latestLogs);
        console.log("Updated Notifications:", latestLogs);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    // Initial data fetch
    fetchData();

    // Polling every 30 seconds
    const intervalId = setInterval(fetchData, 5000); // 30 seconds interval
    // Cleanup on component unmount
    return () => clearInterval(intervalId);
  }, []);

  if (!loaderData) {
    return (
      <div className="min-h-screen flex flex-col gap-5 items-center justify-center text-black bg-gray-100">
        <Logo />
        <div role="status">
          <svg
            aria-hidden="true"
            className="inline w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
            viewBox="0 0 100 101"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
              fill="currentColor"
            />
            <path
              d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
              fill="currentFill"
            />
          </svg>
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  const handleManualRefresh = () => {
    fetchData(); // Manually trigger the data refresh
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between rounded-lg bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Admin Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              Last updated: {new Date(lastRefresh).toLocaleString()}
            </p>
          </div>
          <div className="flex-1 flex justify-center">
            <Logo className="w-40" />
          </div>
          <div className="flex space-x-4">
            <Link
              to="/qr"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200"
            >
              QR Code
            </Link>
            <button
              onClick={handleManualRefresh}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors duration-200"
            >
              Refresh Dashboard
            </button>
            <Link
              to="/logout"
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors duration-200"
            >
              Logout
            </Link>
          </div>
        </div>

        {/* Status Cards */}
        <div className="mb-8 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <SystemStatusComponent
            squareEnvironment={
              systemStatus?.status === "ok" ? "Connected" : "Error"
            }
            isConfigured={systemStatus?.status === "ok"}
          />
          <CheckInSystemStatus
            status={systemStatus?.status || "error"}
            lastChecked={systemStatus?.lastChecked || new Date().toISOString()}
          />
          {webhookStatus && (
            <WebhookStatusComponent webhookStatus={webhookStatus} />
          )}
          <RecentActivity
            totalCheckIns={recentActivity?.totalCheckIns || 0}
            activeMembers={recentActivity?.activeMembers || 0}
            todayCheckIns={recentActivity?.todayCheckIns || 0}
            lastUpdated={
              recentActivity?.lastUpdated || new Date().toISOString()
            }
          />
        </div>

        {/* last Notification */}
        <CheckInNotifications notifications={checkInNotifications} />

        {/* Main Content */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="border-b border-gray-200">
            <AdminTabs activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>

          <div className="mt-6">
            {activeTab === "checkIns" && (
              <CheckInLog checkIns={checkIns} onRefresh={handleManualRefresh} />
            )}

            {activeTab === "members" && (
              <MembersTab members={members} onRefresh={handleManualRefresh} />
            )}

            {activeTab === "membership" && (
              <MembershipStatus
                activeMembers={analytics?.activeMembers || 0}
                needsRenewal={needsRenewalCount || 0}
                membersNeedingRenewal={membersNeedingRenewal || []}
              />
            )}

            {memberMetrics && timeRange && activeTab === "analytics" && (
              <AnalyticsReports
                analytics={{
                  peakHours: analytics?.peakHours || [],
                  topMembers: analytics?.topMembers || [],
                  checkInsByDay:
                    analytics?.checkInsByDay.map((day) => ({
                      ...day,
                      count: Number(day.count),
                    })) || [],
                  membershipTypes: analytics?.membershipTypes || [],
                }}
                timeRange={timeRange}
                memberMetrics={memberMetrics}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
