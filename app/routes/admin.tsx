import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { useState, useEffect } from 'react';
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
import { getRecentCheckIns, getCheckInStats } from '~/models/check-in.server';
import { getAllCustomers, getCustomerStats } from '~/models/customer.server';
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

// Mock data for analytics that we don't have real data for yet
const mockPeakHours = [
  { hour: '17:00-18:00', count: 23 },
  { hour: '18:00-19:00', count: 31 },
  { hour: '19:00-20:00', count: 27 },
  { hour: '07:00-08:00', count: 19 },
  { hour: '08:00-09:00', count: 15 }
];

const mockCheckInsByDay = [
  { date: 'Mon', count: 42 },
  { date: 'Tue', count: 38 },
  { date: 'Wed', count: 45 },
  { date: 'Thu', count: 39 },
  { date: 'Fri', count: 48 },
  { date: 'Sat', count: 52 },
  { date: 'Sun', count: 30 }
];

export async function loader({ request }: LoaderFunctionArgs) {
  // Require admin authentication
  await requireAdmin(request);
  
  try {
    const env = getEnv();
    
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
      
      // We don't have this data yet, using mock data for now
      peakHours: mockPeakHours,
      
      // Get top members by check-in count
      topMembers: members
        .sort((a, b) => b.visitsThisMonth - a.visitsThisMonth)
        .slice(0, 5)
        .map(member => ({
          name: member.name,
          checkIns: member.visitsThisMonth
        })),
      
      // We don't have this data yet, using mock data for now
      checkInsByDay: mockCheckInsByDay,
      
      // Use real membership type data
      membershipTypes: customerStats.membershipTypes.map((type: any) => ({
        type: type.type,
        count: type.count
      }))
    };
    
    // Create recent activity data
    const recentActivity: RecentActivityData = {
      totalCheckIns: checkInStats.total,
      activeMembers: customerStats.activeCustomers,
      todayCheckIns: checkInStats.today,
      lastUpdated: new Date().toISOString(),
      recentLogs: recentLogs.map((log: any) => ({
        id: log.id.toString(),
        timestamp: log.timestamp.toISOString(),
        message: log.message,
        type: log.eventType,
        details: log.details
      }))
    };
    
    return json({
      squareEnvironment: env.SQUARE_ENVIRONMENT,
      isConfigured: !!env.SQUARE_ACCESS_TOKEN,
      checkIns,
      members,
      analytics,
      webhookStatus,
      systemStatus,
      recentActivity
    });
  } catch (error) {
    console.error('Error in admin loader:', error);
    
    // Fallback to mock data if there's an error
    return json({
      squareEnvironment: 'not configured',
      isConfigured: false,
      checkIns: [] as CheckInRecord[],
      members: [] as Member[],
      analytics: {
        totalCheckIns: 0,
        activeMembers: 0,
        needsRenewal: 0,
        peakHours: mockPeakHours,
        topMembers: [],
        checkInsByDay: mockCheckInsByDay,
        membershipTypes: []
      } as AnalyticsData,
      webhookStatus: {
        status: 'error',
        message: 'Error fetching webhook status',
        lastReceived: null,
        signatureValid: false
      } as WebhookStatusData,
      systemStatus: {
        status: 'degraded',
        url: 'unknown',
        lastChecked: new Date().toISOString()
      } as SystemStatusData,
      recentActivity: {
        totalCheckIns: 0,
        activeMembers: 0,
        todayCheckIns: 0,
        lastUpdated: new Date().toISOString()
      } as RecentActivityData
    });
  }
}

export default function Admin() {
  const { 
    squareEnvironment, 
    isConfigured, 
    checkIns: initialCheckIns, 
    members, 
    analytics, 
    webhookStatus,
    systemStatus,
    recentActivity
  } = useLoaderData<typeof loader>();
  
  const [activeTab, setActiveTab] = useState('checkIns');
  const [notifications, setNotifications] = useState<CheckInRecord[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>(initialCheckIns);
  
  // Simulate receiving real-time check-ins
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate a new check-in every 30 seconds
      if (Math.random() > 0.5) {
        const success = Math.random() > 0.3;
        const firstName = success ? 
          ['James', 'Sarah', 'David', 'Emma', 'Michael', 'Lisa', 'Robert', 'Anna'][Math.floor(Math.random() * 8)] : 
          'Unknown';
        const lastName = success ? 
          ['Wilson', 'Johnson', 'Thompson', 'Brown', 'Davis', 'Smith', 'Jones', 'Taylor'][Math.floor(Math.random() * 8)] : 
          'User';
        const fullName = `${firstName} ${lastName}`;
        const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`;
        
        const membershipType = success ? 
          (Math.random() > 0.7 ? 'Cash Payment (£30)' : 'Monthly Subscription (£25)') : 
          'Monthly Subscription (£25)';
        
        // Generate a random future date for next payment
        const nextPaymentDate = new Date();
        nextPaymentDate.setDate(nextPaymentDate.getDate() + Math.floor(Math.random() * 30) + 1);
        const nextPayment = success ? 
          `${nextPaymentDate.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][nextPaymentDate.getMonth()]} ${nextPaymentDate.getFullYear()}` : 
          '';
        
        const message = success ? 
          `Check-in successful (${membershipType === 'Cash Payment (£30)' ? 'Cash payment' : 'Subscription'})` : 
          'Payment overdue. Last payment: 5 Apr 2024';
        
        const newCheckIn: CheckInRecord = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          customerName: fullName,
          phoneNumber: '+44 770 ' + Math.floor(Math.random() * 900 + 100) + ' ' + Math.floor(Math.random() * 9000 + 1000),
          success: success,
          membershipType: membershipType,
          message: message,
          nextPayment: nextPayment,
          initials: initials
        };
        
        // Update both notifications and check-ins
        setNotifications((prev: CheckInRecord[]) => [newCheckIn, ...prev].slice(0, 5));
        setCheckIns((prev: CheckInRecord[]) => [newCheckIn, ...prev]);
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Function to manually refresh check-ins
  const handleManualRefresh = () => {
    // In a real app, this would fetch fresh data from the server
    // For now, we'll just simulate by adding a timestamp to show it refreshed
    const refreshMessage: CheckInRecord = {
      id: 'refresh-' + Date.now().toString(),
      timestamp: new Date().toISOString(),
      customerName: 'System Refresh',
      phoneNumber: '',
      success: true,
      membershipType: '',
      message: 'Check-in log refreshed manually',
      nextPayment: '',
      initials: 'SR'
    };
    
    setCheckIns((prev: CheckInRecord[]) => [refreshMessage, ...prev]);
  };
  
  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <div className="flex space-x-4">
              <Link 
                to="/qr" 
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                View Check-in QR
              </Link>
              <Link 
                to="/logout" 
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Logout
              </Link>
              <Link 
                to="/" 
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </header>
      
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
        {/* Status Section */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">System Overview</h2>
          
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            {/* Square API Status */}
            <SystemStatusComponent 
              squareEnvironment={squareEnvironment}
              isConfigured={isConfigured}
            />
            
            {/* Check-in System Status */}
            <CheckInSystemStatus
              status={systemStatus.status}
              lastChecked={systemStatus.lastChecked}
            />
            
            {/* Webhook Status */}
            <WebhookStatusComponent webhookStatus={webhookStatus} />
            
            {/* Recent Activity */}
            <RecentActivity
              totalCheckIns={recentActivity.totalCheckIns}
              activeMembers={recentActivity.activeMembers}
              todayCheckIns={recentActivity.todayCheckIns}
              lastUpdated={recentActivity.lastUpdated}
            />
          </div>
        </div>
        
        {/* Notifications */}
        <CheckInNotifications notifications={notifications} />
        
        {/* Tabs */}
        <AdminTabs activeTab={activeTab} setActiveTab={setActiveTab} />
        
        {/* Tab Content */}
        <div className="rounded-lg bg-white p-6 shadow">
          {activeTab === 'checkIns' && (
            <CheckInLog checkIns={checkIns} onRefresh={handleManualRefresh} />
          )}
          
          {activeTab === 'members' && (
            <MembersTab members={members} />
          )}
          
          {activeTab === 'membership' && (
            <MembershipStatus 
              activeMembers={analytics.activeMembers}
              needsRenewal={analytics.needsRenewal}
            />
          )}
          
          {activeTab === 'analytics' && (
            <AnalyticsReports 
              peakHours={analytics.peakHours}
              topMembers={analytics.topMembers}
              checkInsByDay={analytics.checkInsByDay}
              membershipTypes={analytics.membershipTypes}
            />
          )}
        </div>
      </main>
      
      <footer className="bg-white py-4 text-center text-sm text-gray-600">
        <p>Gym Check-in System &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
