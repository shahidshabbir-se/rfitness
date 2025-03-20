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
  const [lastEventTimestamp, setLastEventTimestamp] = useState<string>(
    new Date().toISOString()
  );
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
      console.log(data.members);
      setAnalytics(data.analytics);
      setMembersNeedingRenewal(data.membersNeedingRenewal);
      setNeedsRenewalCount(data.needsRenewalCount);
      setTimeRange(data.timeRange);
      setMemberMetrics(data.memberMetrics);
      setLastRefresh(new Date().toISOString());
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    // Initial data fetch
    fetchData();

    // Polling every 30 seconds
    const intervalId = setInterval(fetchData, 5000); // 30 seconds interval
    console.log("Polling for new data every 1 second...");
    // Cleanup on component unmount
    return () => clearInterval(intervalId);
  }, []);

  if (!loaderData) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black bg-gray-100">
        <p>Loading...</p>
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
