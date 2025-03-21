import React from 'react';
import type { SystemStatusData } from '~/types';

interface CheckInSystemStatusProps {
  status: string;
  lastChecked: string;
}

export default function CheckInSystemStatus({ status, lastChecked }: CheckInSystemStatusProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-2 text-sm font-medium text-gray-500">Check-In System Status</h3>
      
      <div className="mb-3 flex items-center">
        <div className={`mr-2 h-3 w-3 rounded-full ${
          status === 'ok' 
            ? 'bg-green-500' 
            : status === 'error' 
              ? 'bg-red-500' 
              : 'bg-yellow-500'
        }`}></div>
        <p className="font-medium text-gray-800">
          {status === 'ok' 
            ? 'Online' 
            : status === 'error' 
              ? 'Error' 
              : 'Degraded'}
        </p>
      </div>
      
      <div className="space-y-2 text-sm">
        <p className="text-gray-600">
          <span className="font-medium">Last Checked:</span> {new Date(lastChecked).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
