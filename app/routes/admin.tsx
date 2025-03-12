import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { getEnv } from '~/utils/env.server';
import type { CheckInRecord, WebhookStatus, Member, SystemStatus, AnalyticsData } from '~/types';
import { getWebhookStatus } from '~/utils/webhook.server';
import { requireAdmin } from '~/utils/session.server';
import { getCheckInSystemStatus, getRecentActivity } from '~/utils/system.server';

// Import refactored components
import SystemStatus from '~/components/admin/SystemStatus';
import CheckInSystemStatus from '~/components/admin/CheckInSystemStatus';
import CheckInNotifications from '~/components/admin/CheckInNotifications';
import AdminTabs from '~/components/admin/AdminTabs';
import CheckInLog from '~/components/admin/CheckInLog';
import MembershipStatus from '~/components/admin/MembershipStatus';
import AnalyticsReports from '~/components/admin/AnalyticsReports';
import WebhookStatus from '~/components/admin/WebhookStatus';
import MembersTab from '~/components/admin/MembersTab';
import RecentActivity from '~/components/admin/RecentActivity';

// Mock data for demonstration - in a real app, this would come from a database
const mockCheckIns: CheckInRecord[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(), // 5 minutes ago
    customerName: 'James Wilson',
    phoneNumber: '+44 770 123 4567',
    success: true,
    membershipType: 'Monthly Subscription (£25)',
    message: 'Check-in successful (Subscription)',
    nextPayment: '12 May 2024',
    initials: 'JW'
  },
  // ... other mock check-ins
];

// Mock data for members
const mockMembers: Member[] = [
  {
    id: '1',
    name: 'James Wilson',
    phoneNumber: '+44 770 123 4567',
    membershipType: 'Monthly Subscription (£25)',
    status: 'Active',
    nextPayment: '12 May 2024',
    lastCheckIn: '04/03/2025',
    visitsThisMonth: 15,
    initials: 'JW'
  },
  // ... other mock members
];

// Mock data for analytics
const mockAnalytics: AnalyticsData = {
  totalCheckIns: 127,
  activeMembers: 84,
  needsRenewal: 12,
  peakHours: [
    { hour: '17:00-18:00', count: 23 },
    { hour: '18:00-19:00', count: 31 },
    { hour: '19:00-20:00', count: 27 },
    { hour: '07:00-08:00', count: 19 },
    { hour: '08:00-09:00', count: 15 }
  ],
  topMembers: [
    { name: 'David Wilson', checkIns: 24 },
    { name: 'Emma Thompson', checkIns: 22 },
    { name: 'James Brown', checkIns: 19 },
    { name: 'Lisa Anderson', checkIns: 17 },
    { name: 'Robert Davis', checkIns: 15 }
  ],
  checkInsByDay: [
    { date: 'Mon', count: 42 },
    { date: 'Tue', count: 38 },
    { date: 'Wed', count: 45 },
    { date: 'Thu', count: 39 },
    { date: 'Fri', count: 48 },
    { date: 'Sat', count: 52 },
    { date: 'Sun', count: 30 }
  ],
  membershipTypes: [
    { type: 'Monthly Subscription', count: 65 },
    { type: 'Cash Payment', count: 25 }
  ]
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Require admin authentication
  await requireAdmin(request);
  
  try {
    const env = getEnv();
    
    // Get real webhook status
    const webhookStatus = getWebhookStatus();
    
    // Get check-in system status
    const systemStatus = await getCheckInSystemStatus();
    
    // Get recent activity data
    const recentActivity = await getRecentActivity();
    
    return json({
      squareEnvironment: env.SQUARE_ENVIRONMENT,
      isConfigured: !!env.SQUARE_ACCESS_TOKEN,
      checkIns: mockCheckIns,
      members: mockMembers,
      analytics: mockAnalytics,
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
      checkIns: mockCheckIns,
      members: mockMembers,
      analytics: mockAnalytics,
      webhookStatus: {
        status: 'error',
        message: 'Error fetching webhook status',
        lastReceived: null,
        signatureValid: false
      },
      systemStatus: {
        status: 'degraded',
        url: 'unknown',
        lastChecked: new Date().toISOString()
      },
      recentActivity: {
        totalCheckIns: 0,
        activeMembers: 0,
        todayCheckIns: 0,
        lastUpdated: new Date().toISOString()
      }
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
  
  // Set up SSE connection for real-time notifications
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
        const checkInData = JSON.parse(event.data);
        console.log('Received check-in via SSE:', checkInData);
        
        // Update notifications and check-ins
        setNotifications(prev => [checkInData, ...prev].slice(0, 5));
        setCheckIns(prev => [checkInData, ...prev]);
      } catch (error) {
        console.error('Error processing SSE check-in event:', error);
      }
    });
    
    // Handle errors
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      // Attempt to reconnect after a delay
      setTimeout(() => {
        eventSource.close();
        // The browser will automatically attempt to reconnect
      }, 5000);
    };
    
    // Clean up on unmount
    return () => {
      console.log('Closing SSE connection');
      eventSource.close();
    };
  }, []);
  
  // For development/testing only - simulate check-ins if needed
  // This can be removed in production or controlled via env variable
  useEffect(() => {
    // Check if we should use simulated data (for development/testing)
    const isSimulated = squareEnvironment === 'sandbox' && 
                        window.location.hostname === 'localhost';
    
    if (!isSimulated) return;
    
    console.log('Using simulated check-ins for development');
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
        setNotifications(prev => [newCheckIn, ...prev].slice(0, 5));
        setCheckIns(prev => [newCheckIn, ...prev]);
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [squareEnvironment]);
  
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
    
    setCheckIns(prev => [refreshMessage, ...prev]);
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
            <SystemStatus 
              squareEnvironment={squareEnvironment}
              isConfigured={isConfigured}
            />
            
            {/* Check-in System Status */}
            <CheckInSystemStatus
              status={systemStatus.status}
              url={systemStatus.url}
              lastChecked={systemStatus.lastChecked}
            />
            
            {/* Webhook Status */}
            <WebhookStatus webhookStatus={webhookStatus} />
            
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
