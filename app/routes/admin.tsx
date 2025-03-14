import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link, useFetcher } from '@remix-run/react';
import { useState, useEffect, useCallback } from 'react';
import { getEnv } from '~/utils/env.server';
import type { 
  CheckInRecord, 
  WebhookStatusData, 
  Member, 
  SystemStatusData, 
  AnalyticsData,
  RecentActivityData
} from '~/types';
import { getWebhookStatus } from '~/utils/webhook.server';
import { requireAdmin } from '~/utils/session.server';
import { getCheckInSystemStatus, getRecentActivity } from '~/utils/system.server';
import { getMembersNeedingRenewal } from '~/utils/square.server';
import Logo from '~/components/common/Logo';

// Import database models
import { getRecentCheckIns, getCheckInStats, getCheckInPeakHours, getCheckInsByDayOfWeek } from '~/models/check-in.server';
import { getAllCustomers, getCustomerStats, getMemberMetrics } from '~/models/customer.server';
import { getSystemLogs } from '~/models/system-log.server';

// Import refactored components
import SystemStatusComponent from '~/components/admin/SystemStatus';
import CheckInSystemStatus from '~/components/admin/CheckInSystemStatus';
import CheckInNotifications from '~/components/admin/CheckInNotifications';
import AdminTabs from '~/components/admin/AdminTabs';
import CheckInLog from '~/components/admin/CheckInLog';
import MembershipStatus from '~/components/admin/MembershipStatus';
import AnalyticsReports from '~/components/admin/AnalyticsReports';
import WebhookStatusComponent from '~/components/admin/WebhookStatus';
import MembersTab from '~/components/admin/MembersTab';
import RecentActivity from '~/components/admin/RecentActivity';

export async function loader({ request }: LoaderFunctionArgs) {
  // Require admin authentication
  await requireAdmin(request);
  
  try {
    const env = getEnv();
    
    // Get time range from URL if provided
    const url = new URL(request.url);
    const timeRange = (url.searchParams.get('timeRange') || 'week') as 'week' | 'month' | 'quarter';
    
    // Check if this is a recent-events request
    const since = url.searchParams.get('since');
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const isRecentEventsRequest = url.searchParams.has('since');
    
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
        eventType: 'customer_webhook',
        after: sinceDate
      });
      
      const { logs: subscriptionLogs } = await getSystemLogs({
        page: 1,
        limit,
        eventType: 'subscription_webhook',
        after: sinceDate
      });
      
      // Transform check-ins to the expected format
      const checkInRecords: CheckInRecord[] = checkInsData.checkIns
        .filter((checkIn: any) => new Date(checkIn.checkInTime) > sinceDate)
        .map((checkIn: any) => ({
          id: checkIn.id.toString(),
          timestamp: checkIn.checkInTime.toISOString(),
          customerName: checkIn.customerName || (checkIn.customer?.name) || 'Unknown',
          phoneNumber: checkIn.phoneNumber || (checkIn.customer?.phoneNumber) || '',
          success: true, // All stored check-ins are successful
          membershipType: checkIn.membershipType || (checkIn.customer?.membershipType) || 'Unknown',
          message: 'Check-in successful',
          nextPayment: '', // We don't have this information yet
          initials: (checkIn.customerName || (checkIn.customer?.name) || 'Unknown')
            .split(' ')
            .map((name: string) => name[0])
            .join('')
            .substring(0, 2)
        }));
      
      // Transform customer logs to the expected format
      const customerEvents = customerLogs.map((log: any) => ({
        id: `customer-update-${log.id}`,
        timestamp: log.timestamp.toISOString(),
        customerName: log.details?.customerName || 'Customer',
        phoneNumber: log.details?.phoneNumber || '',
        success: true,
        membershipType: 'Update',
        message: `Customer ${log.details?.eventType?.split('.')?.[1] || 'updated'}: ${log.details?.customerName || 'Unknown'}`,
        nextPayment: '',
        initials: log.details?.customerName 
          ? log.details.customerName.split(' ').map((n: string) => n[0]).join('').substring(0, 2) 
          : 'CU',
        eventType: 'customer-update'
      }));
      
      // Transform subscription logs to the expected format
      const subscriptionEvents = subscriptionLogs.map((log: any) => ({
        id: `subscription-update-${log.id}`,
        timestamp: log.timestamp.toISOString(),
        customerName: 'Subscription Update',
        phoneNumber: log.details?.customerId || '',
        success: log.details?.status === 'ACTIVE',
        membershipType: 'Subscription',
        message: `Subscription ${log.details?.eventType?.split('.')?.[1] || 'updated'}: ${log.details?.status || 'Unknown'}`,
        nextPayment: '',
        initials: 'SU',
        eventType: 'subscription-update'
      }));
      
      // Combine all events and sort by timestamp (newest first)
      const allEvents = [...checkInRecords, ...customerEvents, ...subscriptionEvents]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
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
          membershipTypes: []
        },
        recentActivity: {
          totalCheckIns: 0,
          activeMembers: 0,
          todayCheckIns: 0,
          lastUpdated: new Date().toISOString(),
          recentLogs: []
        },
        timeRange: 'week',
        memberMetrics: {
          newMembers: 0,
          retentionRate: 0,
          newMembersChange: '0%',
          retentionChange: '0%'
        },
        membersNeedingRenewal: [],
        needsRenewalCount: 0
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
      eventType: 'check_in'
    });
    
    // Transform database data to match expected formats
    const checkIns: CheckInRecord[] = checkInsData.checkIns.map((checkIn: any) => ({
      id: checkIn.id.toString(),
      timestamp: checkIn.checkInTime.toISOString(),
      customerName: checkIn.customerName || checkIn.customer.name,
      phoneNumber: checkIn.phoneNumber || checkIn.customer.phoneNumber || '',
      success: true, // All stored check-ins are successful
      membershipType: checkIn.membershipType || checkIn.customer.membershipType || 'Unknown',
      message: 'Check-in successful',
      nextPayment: '', // We don't have this information yet
      initials: (checkIn.customerName || checkIn.customer.name)
        .split(' ')
        .map((name: string) => name[0])
        .join('')
        .substring(0, 2)
    }));
    
    const members: Member[] = customersData.customers.map((customer: any) => {
      // Find the most recent check-in for this customer
      const lastCheckIn = customer.checkIns && customer.checkIns.length > 0 
        ? customer.checkIns[0].checkInTime 
        : null;
      
      // Calculate visits this month
      const visitsThisMonth = customer._count?.checkIns || 0;
      
      // Determine status based on membershipType
      const status = customer.membershipType === 'Active' || customer.membershipType === 'Monthly Subscription (£25)' || customer.membershipType === 'Cash Payment (£30)'
        ? 'Active'
        : 'Inactive';
      
      return {
        id: customer.id,
        name: customer.name,
        phoneNumber: customer.phoneNumber || '',
        membershipType: customer.membershipType || 'Unknown',
        status: status, // Use the determined status instead of hardcoding
        nextPayment: '', // We don't have this information yet
        lastCheckIn: lastCheckIn ? new Date(lastCheckIn).toLocaleDateString() : 'Never',
        visitsThisMonth,
        initials: customer.name
          .split(' ')
          .map((name: string) => name[0])
          .join('')
          .substring(0, 2)
      };
    });
    
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
        .map(member => ({
          name: member.name,
          checkIns: member.visitsThisMonth
        })),
      
      // Use real check-ins by day data
      checkInsByDay: checkInsByDay || [],
      
      // Use real membership type data
      membershipTypes: customerStats.membershipTypes ? customerStats.membershipTypes.map((type: any) => ({
        type: type.type || 'Unknown',
        count: type.count || 0
      })) : []
    };
    
    // Get recent activity
    const recentActivity: RecentActivityData = await getRecentActivity();
    
    // Get members needing renewal
    const membersNeedingRenewalData = await getMembersNeedingRenewal();
    
    return json({
      checkIns,
      members,
      analytics,
      systemStatus,
      webhookStatus,
      recentActivity,
      timeRange,
      memberMetrics,
      membersNeedingRenewal: membersNeedingRenewalData.members,
      needsRenewalCount: membersNeedingRenewalData.count
    });
  } catch (error) {
    console.error('Error loading admin data:', error);
    return json({
      error: 'Failed to load admin data',
      message: error instanceof Error ? error.message : 'Unknown error',
      checkIns: [],
      members: [],
      analytics: {
        totalCheckIns: 0,
        activeMembers: 0,
        needsRenewal: 0,
        peakHours: [],
        topMembers: [],
        checkInsByDay: [],
        membershipTypes: []
      },
      systemStatus: {
        status: 'error',
        url: '',
        lastChecked: new Date().toISOString(),
        lastCheckIn: null
      },
      webhookStatus: {
        status: 'error',
        message: 'Error loading webhook status',
        lastReceived: null,
        signatureValid: false
      },
      recentActivity: {
        totalCheckIns: 0,
        activeMembers: 0,
        todayCheckIns: 0,
        lastUpdated: new Date().toISOString(),
        recentLogs: []
      },
      timeRange: 'week',
      memberMetrics: {
        newMembers: 0,
        retentionRate: 0,
        newMembersChange: '0%',
        retentionChange: '0%'
      },
      membersNeedingRenewal: [],
      needsRenewalCount: 0
    }, { status: 500 });
  }
}

export default function AdminDashboard() {
  const { 
    checkIns: initialCheckIns, 
    members: initialMembers, 
    analytics, 
    systemStatus, 
    webhookStatus, 
    recentActivity,
    timeRange,
    memberMetrics,
    membersNeedingRenewal,
    needsRenewalCount
  } = useLoaderData<typeof loader>();
  
  const fetcher = useFetcher();
  const [activeTab, setActiveTab] = useState('checkIns');
  const [notifications, setNotifications] = useState<CheckInRecord[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>(initialCheckIns || []);
  const [members, setMembers] = useState<Member[]>(initialMembers || []);
  const [lastRefresh, setLastRefresh] = useState<string>(new Date().toISOString());
  const [lastEventTimestamp, setLastEventTimestamp] = useState<string>(new Date().toISOString());
  
  // Function to fetch fresh data from the server
  const refreshData = useCallback(() => {
    fetcher.load('/admin');
    setLastRefresh(new Date().toISOString());
  }, [fetcher]);
  
  // Update data when fetcher returns new data
  useEffect(() => {
    if (fetcher.data) {
      const data = fetcher.data;
      if (data.checkIns) setCheckIns(data.checkIns);
      if (data.members) setMembers(data.members);
    }
  }, [fetcher.data]);
  
  // Set up polling for real-time check-in notifications
  useEffect(() => {
    // Function to fetch recent events
    const fetchRecentEvents = async () => {
      try {
        // Use the admin route with since parameter for polling
        const response = await fetch(`/admin?since=${encodeURIComponent(lastEventTimestamp)}&limit=20`);
        if (!response.ok) {
          throw new Error(`Failed to fetch recent events: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Update last event timestamp for next poll
        if (data.timestamp) {
          setLastEventTimestamp(data.timestamp);
        }
        
        // Process events if any
        if (data.events && data.events.length > 0) {
          // Update notifications with new events
          setNotifications(prev => {
            const newNotifications = [...data.events, ...prev].slice(0, 5);
            return newNotifications;
          });
          
          // Update check-ins with new check-in events
          const newCheckIns = data.events.filter((event: any) => !event.eventType || event.eventType === 'check-in');
          if (newCheckIns.length > 0) {
            setCheckIns(prev => [...newCheckIns, ...prev]);
          }
          
          // If there are customer or subscription updates, refresh all data
          const hasUpdates = data.events.some((event: any) => 
            event.eventType === 'customer-update' || event.eventType === 'subscription-update'
          );
          
          if (hasUpdates) {
            refreshData();
          }
        }
      } catch (error) {
        console.error('Error polling for recent events:', error);
      }
    };
    
    // Initial fetch
    fetchRecentEvents();
    
    // Set up polling interval
    const pollingInterval = setInterval(fetchRecentEvents, 5000); // Poll every 5 seconds
    
    // Clean up on unmount
    return () => {
      clearInterval(pollingInterval);
    };
  }, [lastEventTimestamp, refreshData]);
  
  // Function to manually refresh check-ins
  const handleManualRefresh = () => {
    refreshData();
    
    // Add a refresh message to the check-ins
    const refreshMessage: CheckInRecord = {
      id: 'refresh-' + Date.now().toString(),
      timestamp: new Date().toISOString(),
      customerName: 'System Refresh',
      phoneNumber: '',
      success: true,
      membershipType: 'System',
      message: 'Check-in log refreshed manually',
      nextPayment: '',
      initials: 'SR'
    };
    
    setNotifications((prev) => [refreshMessage, ...prev].slice(0, 5));
  };
  
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between rounded-lg bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
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
              onClick={refreshData}
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
            squareEnvironment={systemStatus?.status === 'ok' ? 'Connected' : 'Error'} 
            isConfigured={systemStatus?.status === 'ok'} 
          />
          <CheckInSystemStatus 
            status={systemStatus?.status || 'error'} 
            lastChecked={systemStatus?.lastChecked || new Date().toISOString()} 
          />
          <WebhookStatusComponent webhookStatus={webhookStatus} />
          <RecentActivity 
            totalCheckIns={recentActivity?.totalCheckIns || 0}
            activeMembers={recentActivity?.activeMembers || 0}
            todayCheckIns={recentActivity?.todayCheckIns || 0}
            lastUpdated={recentActivity?.lastUpdated || new Date().toISOString()}
          />
        </div>
        
        {/* Notifications */}
        <CheckInNotifications notifications={notifications} />
        
        {/* Main Content */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="border-b border-gray-200">
            <AdminTabs activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
          
          <div className="mt-6">
            {activeTab === 'checkIns' && (
              <CheckInLog checkIns={checkIns} onRefresh={handleManualRefresh} />
            )}
            
            {activeTab === 'members' && (
              <MembersTab members={members} onRefresh={refreshData} />
            )}
            
            {activeTab === 'membership' && (
              <MembershipStatus 
                activeMembers={analytics?.activeMembers || 0} 
                needsRenewal={needsRenewalCount || 0}
                membersNeedingRenewal={membersNeedingRenewal || []}
              />
            )}
            
            {activeTab === 'analytics' && (
              <AnalyticsReports 
                analytics={{
                  peakHours: analytics?.peakHours || [],
                  topMembers: analytics?.topMembers || [],
                  checkInsByDay: analytics?.checkInsByDay || [],
                  membershipTypes: analytics?.membershipTypes || []
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
