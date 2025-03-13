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
      
      return {
        id: customer.id,
        name: customer.name,
        phoneNumber: customer.phoneNumber || '',
        membershipType: customer.membershipType || 'Unknown',
        status: 'Active', // We don't have status information yet
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
      peakHours,
      
      // Get top members by check-in count
      topMembers: members
        .sort((a, b) => b.visitsThisMonth - a.visitsThisMonth)
        .slice(0, 5)
        .map(member => ({
          name: member.name,
          checkIns: member.visitsThisMonth
        })),
      
      // Use real check-ins by day data
      checkInsByDay,
      
      // Use real membership type data
      membershipTypes: customerStats.membershipTypes.map((type: any) => ({
        type: type.type,
        count: type.count
      }))
    };
    
    // Get recent activity
    const recentActivity: RecentActivityData = await getRecentActivity();
    
    return json({
      checkIns,
      members,
      analytics,
      systemStatus,
      webhookStatus,
      recentActivity,
      timeRange,
      memberMetrics
    });
  } catch (error) {
    console.error('Error loading admin data:', error);
    return json({
      error: 'Failed to load admin data',
      message: error instanceof Error ? error.message : 'Unknown error'
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
    memberMetrics
  } = useLoaderData<typeof loader>();
  
  const fetcher = useFetcher();
  const [activeTab, setActiveTab] = useState('checkIns');
  const [notifications, setNotifications] = useState<CheckInRecord[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>(initialCheckIns);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [lastRefresh, setLastRefresh] = useState<string>(new Date().toISOString());
  
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
  
  // Set up SSE connection for real-time check-in notifications
  useEffect(() => {
    // Create EventSource for SSE
    const eventSource = new EventSource('/api/sse');
    
    // Handle connection open
    eventSource.onopen = () => {
      console.log('SSE connection established');
    };
    
    // Handle check-in events
    eventSource.addEventListener('check-in', (event) => {
      try {
        const checkInRecord = JSON.parse(event.data) as CheckInRecord;
        
        // Update notifications and check-ins
        setNotifications((prev) => [checkInRecord, ...prev].slice(0, 5));
        setCheckIns((prev) => [checkInRecord, ...prev]);
      } catch (error) {
        console.error('Error parsing check-in event:', error);
      }
    });
    
    // Handle customer update events
    eventSource.addEventListener('customer-update', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received customer update:', data);
        
        // Refresh data to get the latest changes
        refreshData();
        
        // Show notification about the update
        const updateNotification: CheckInRecord = {
          id: `customer-update-${Date.now()}`,
          timestamp: data.timestamp,
          customerName: data.customerName || 'Customer',
          phoneNumber: data.phoneNumber || '',
          success: true,
          membershipType: 'Update',
          message: `Customer ${data.eventType.split('.')[1]}: ${data.customerName}`,
          nextPayment: '',
          initials: data.customerName ? data.customerName.split(' ').map((n: string) => n[0]).join('').substring(0, 2) : 'CU'
        };
        
        setNotifications((prev) => [updateNotification, ...prev].slice(0, 5));
      } catch (error) {
        console.error('Error handling customer update:', error);
      }
    });
    
    // Handle subscription update events
    eventSource.addEventListener('subscription-update', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received subscription update:', data);
        
        // Refresh data to get the latest changes
        refreshData();
        
        // Show notification about the update
        const updateNotification: CheckInRecord = {
          id: `subscription-update-${Date.now()}`,
          timestamp: data.timestamp,
          customerName: 'Subscription Update',
          phoneNumber: data.customerId || '',
          success: data.status === 'ACTIVE',
          membershipType: 'Subscription',
          message: `Subscription ${data.eventType.split('.')[1]}: ${data.status}`,
          nextPayment: '',
          initials: 'SU'
        };
        
        setNotifications((prev) => [updateNotification, ...prev].slice(0, 5));
      } catch (error) {
        console.error('Error handling subscription update:', error);
      }
    });
    
    // Handle errors
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      // Try to reconnect after a delay
      setTimeout(() => {
        eventSource.close();
      }, 5000);
    };
    
    // Clean up on unmount
    return () => {
      eventSource.close();
    };
  }, [refreshData]);
  
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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col items-start justify-between space-y-4 md:flex-row md:items-center md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500">
            Last updated: {new Date(lastRefresh).toLocaleString()}
          </p>
        </div>
        <button
          onClick={refreshData}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Refresh Dashboard
        </button>
      </div>
      
      {/* Notifications */}
      <CheckInNotifications notifications={notifications} />
      
      {/* Status Cards */}
      <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <SystemStatusComponent status={systemStatus} />
        <CheckInSystemStatus stats={analytics} />
        <MembershipStatus stats={analytics} />
        <WebhookStatusComponent status={webhookStatus} />
      </div>
      
      {/* Main Content */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <AdminTabs activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className="mt-6">
          {activeTab === 'checkIns' && (
            <CheckInLog checkIns={checkIns} onRefresh={handleManualRefresh} />
          )}
          
          {activeTab === 'members' && (
            <MembersTab members={members} onRefresh={refreshData} />
          )}
          
          {activeTab === 'analytics' && (
            <AnalyticsReports 
              analytics={analytics} 
              timeRange={timeRange}
              memberMetrics={memberMetrics}
            />
          )}
          
          {activeTab === 'activity' && (
            <RecentActivity data={recentActivity} />
          )}
        </div>
      </div>
    </div>
  );
}
