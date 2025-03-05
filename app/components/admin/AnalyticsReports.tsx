import { useState } from 'react';

interface AnalyticsReportsProps {
  peakHours: Array<{ hour: string; count: number }>;
  topMembers: Array<{ name: string; checkIns: number }>;
  checkInsByDay?: Array<{ date: string; count: number }>;
  membershipTypes?: Array<{ type: string; count: number }>;
}

export default function AnalyticsReports({ 
  peakHours, 
  topMembers,
  checkInsByDay = [], 
  membershipTypes = []
}: AnalyticsReportsProps) {
  const [timeRange, setTimeRange] = useState('week');
  
  // If no data is provided for these, create some sample data
  const defaultCheckInsByDay = checkInsByDay.length > 0 ? checkInsByDay : [
    { date: 'Mon', count: 42 },
    { date: 'Tue', count: 38 },
    { date: 'Wed', count: 45 },
    { date: 'Thu', count: 39 },
    { date: 'Fri', count: 48 },
    { date: 'Sat', count: 52 },
    { date: 'Sun', count: 30 }
  ];
  
  // Filter out any trial members from membership types
  const filteredMembershipTypes = membershipTypes.length > 0 
    ? membershipTypes.filter(type => type.type !== 'Trial')
    : [
        { type: 'Monthly Subscription', count: 65 },
        { type: 'Cash Payment', count: 25 }
      ];
  
  // Calculate max values for scaling
  const maxCheckInCount = Math.max(...defaultCheckInsByDay.map(day => day.count));
  const totalMembers = filteredMembershipTypes.reduce((sum, type) => sum + type.count, 0);
  
  // Function to handle exporting analytics data
  const handleExportReports = () => {
    // Create a data object with all analytics information
    const exportData = {
      timeRange,
      checkInsByDay: defaultCheckInsByDay,
      membershipTypes: filteredMembershipTypes,
      peakHours,
      topMembers,
      averageDailyCheckIns: Math.round(defaultCheckInsByDay.reduce((sum, day) => sum + day.count, 0) / defaultCheckInsByDay.length),
      memberRetention: "92%",
      newMembers: 18,
      exportDate: new Date().toISOString()
    };
    
    // Convert to JSON string
    const dataStr = JSON.stringify(exportData, null, 2);
    
    // Create a blob with the data
    const blob = new Blob([dataStr], { type: 'application/json' });
    
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Create a link element
    const link = document.createElement('a');
    link.href = url;
    link.download = `gym-analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.json`;
    
    // Append to body, click and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Release the URL object
    URL.revokeObjectURL(url);
  };
  
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Analytics & Reports</h2>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Time Range:</span>
          <select 
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 90 Days</option>
          </select>
        </div>
      </div>
      
      <div className="mb-8 grid gap-6 md:grid-cols-2">
        {/* Check-ins by Day */}
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-4 text-lg font-medium text-gray-800">Check-ins by Day</h3>
          <div className="flex h-64 items-end justify-between space-x-2">
            {defaultCheckInsByDay.map((day, index) => (
              <div key={index} className="flex flex-1 flex-col items-center">
                <div 
                  className="w-full rounded-t-sm bg-blue-500 transition-all duration-500 ease-in-out hover:bg-blue-600"
                  style={{ 
                    height: `${(day.count / maxCheckInCount) * 100}%`,
                    minHeight: '4px'
                  }}
                ></div>
                <div className="mt-2 text-xs font-medium text-gray-600">{day.date}</div>
                <div className="text-xs font-semibold text-gray-800">{day.count}</div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Membership Distribution */}
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-4 text-lg font-medium text-gray-800">Membership Distribution</h3>
          <div className="flex h-64 flex-col justify-center space-y-6">
            {filteredMembershipTypes.map((type, index) => {
              const percentage = Math.round((type.count / totalMembers) * 100);
              return (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{type.type}</span>
                    <span className="text-sm font-semibold text-gray-900">{percentage}% ({type.count})</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div 
                      className={`h-full rounded-full ${
                        index === 0 ? 'bg-blue-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Peak Hours */}
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-3 text-lg font-medium text-gray-800">Peak Hours</h3>
          <div className="space-y-3">
            {peakHours.map((hour, index) => (
              <div key={index} className="flex items-center">
                <div className="w-24 text-sm text-gray-600">{hour.hour}</div>
                <div className="flex-1">
                  <div className="relative h-4 w-full overflow-hidden rounded-full bg-gray-200">
                    <div 
                      className="absolute h-full rounded-full bg-blue-600 transition-all duration-500 ease-in-out" 
                      style={{ width: `${(hour.count / Math.max(...peakHours.map(h => h.count))) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="ml-3 w-10 text-right text-sm font-medium text-gray-900">{hour.count}</div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Top Members */}
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-3 text-lg font-medium text-gray-800">Top Members</h3>
          <div className="space-y-3">
            {topMembers.map((member, index) => (
              <div key={index} className="flex items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-800">
                  {index + 1}
                </div>
                <div className="ml-3 flex-1 text-sm font-medium text-gray-900">{member.name}</div>
                <div className="text-sm text-gray-600">{member.checkIns} check-ins</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="mt-8 rounded-lg border border-gray-200 p-4">
        <h3 className="mb-4 text-lg font-medium text-gray-800">Key Metrics</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard 
            title="Average Daily Check-ins" 
            value={Math.round(defaultCheckInsByDay.reduce((sum, day) => sum + day.count, 0) / defaultCheckInsByDay.length)} 
            change="+5%" 
            isPositive={true}
          />
          <MetricCard 
            title="Member Retention" 
            value="92%" 
            change="+2%" 
            isPositive={true}
          />
          <MetricCard 
            title="New Members" 
            value="18" 
            change="-3" 
            isPositive={false}
          />
        </div>
      </div>
      
      <div className="mt-6 flex justify-end">
        <button 
          onClick={handleExportReports}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Export Reports
        </button>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
}

function MetricCard({ title, value, change, isPositive }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h4 className="text-sm font-medium text-gray-500">{title}</h4>
      <div className="mt-2 flex items-baseline">
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        <p className={`ml-2 text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? '↑' : '↓'} {change}
        </p>
      </div>
    </div>
  );
}
