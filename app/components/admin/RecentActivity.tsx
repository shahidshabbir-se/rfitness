import React from 'react';

interface RecentActivityProps {
  totalCheckIns: number;
  activeMembers: number;
  todayCheckIns: number;
  lastUpdated: string;
}

export default function RecentActivity({ 
  totalCheckIns, 
  activeMembers, 
  todayCheckIns,
  lastUpdated 
}: RecentActivityProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-2 text-sm font-medium text-gray-500">Recent Activity</h3>
      <p className="font-medium text-gray-800">
        {totalCheckIns} Total Check-ins
      </p>
      <p className="mt-1 text-sm text-gray-600">
        {activeMembers} Active Members
      </p>
      <p className="mt-1 text-sm text-gray-600">
        {todayCheckIns} Check-ins Today
      </p>
      <p className="mt-2 text-xs text-gray-500">
        Updated: {new Date(lastUpdated).toLocaleTimeString()}
      </p>
    </div>
  );
}
