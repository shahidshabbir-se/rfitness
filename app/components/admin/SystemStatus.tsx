import React from 'react';

interface SystemStatusProps {
  squareEnvironment: string;
  isConfigured: boolean;
}

export default function SystemStatus({ squareEnvironment, isConfigured }: SystemStatusProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-2 text-sm font-medium text-gray-500">Square API</h3>
      <div className="flex items-center">
        <div className={`mr-2 h-3 w-3 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <p className="font-medium text-gray-800">
          {isConfigured ? 'Connected' : 'Not Configured'}
        </p>
      </div>
      <p className="mt-2 text-sm text-gray-600">
        Environment: {squareEnvironment}
      </p>
    </div>
  );
}
