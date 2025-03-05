import React from 'react';
import type { SystemStatusData } from '~/types';

interface CheckInSystemStatusProps {
  status: SystemStatusData;
}

export default function CheckInSystemStatus({ status }: CheckInSystemStatusProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-2 text-sm font-medium text-gray-500">Check-In System Status</h3>
      
      <div className="mb-3 flex items-center">
        <div className={`mr-2 h-3 w-3 rounded-full ${
          status.squareApiStatus === 'connected' 
            ? 'bg-green-500' 
            : status.squareApiStatus === 'error' 
              ? 'bg-red-500' 
              : 'bg-yellow-500'
        }`}></div>
        <p className="font-medium text-gray-800">
          {status.squareApiStatus === 'connected' 
            ? 'Online' 
            : status.squareApiStatus === 'error' 
              ? 'Error' 
              : 'Not Configured'}
        </p>
      </div>
      
      <div className="space-y-2 text-sm">
        <p className="text-gray-600">
          <span className="font-medium">Environment:</span> {status.environment}
        </p>
        
        <p className="text-gray-600">
          <span className="font-medium">Uptime:</span> {status.uptime}
        </p>
        
        {status.lastError && (
          <div className="rounded-md bg-red-50 p-2 text-red-800">
            <p className="font-medium">Last Error:</p>
            <p className="text-xs">{new Date(status.lastError.timestamp).toLocaleString()}</p>
            <p className="text-sm">{status.lastError.message}</p>
          </div>
        )}
        
        {status.lastCheckIn && (
          <div className={`rounded-md p-2 ${
            status.lastCheckIn.success ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
          }`}>
            <p className="font-medium">Last Check-In:</p>
            <p className="text-xs">{new Date(status.lastCheckIn.timestamp).toLocaleString()}</p>
            <p className="text-sm">{status.lastCheckIn.customerName}</p>
          </div>
        )}
      </div>
    </div>
  );
}
