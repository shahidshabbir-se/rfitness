import type { CheckInResult } from '~/types';

interface CheckInResultProps {
  result: CheckInResult;
  onNewCheckIn: () => void;
}

export default function CheckInResult({ result, onNewCheckIn }: CheckInResultProps) {
  return (
    <div className="space-y-6">
      <div className={`rounded-lg p-4 text-center ${
        result.success 
          ? 'bg-green-100 text-green-800' 
          : 'bg-red-100 text-red-800'
      }`}>
        <p className="font-medium">{result.message}</p>
      </div>
      
      {result.customerData && (
        <div className="space-y-3 rounded-lg border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700">Member Information</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {result.customerData.name && (
              <>
                <div className="text-gray-500">Name:</div>
                <div>{result.customerData.name}</div>
              </>
            )}
            
            {result.customerData.membershipStatus && (
              <>
                <div className="text-gray-500">Membership Status:</div>
                <div>{result.customerData.membershipStatus}</div>
              </>
            )}
            
            {result.customerData.expirationDate && (
              <>
                <div className="text-gray-500">Paid Until:</div>
                <div>{new Date(result.customerData.expirationDate).toLocaleDateString()}</div>
              </>
            )}
            
            {result.customerData.paymentStatus && (
              <>
                <div className="text-gray-500">Payment Status:</div>
                <div>{result.customerData.paymentStatus}</div>
              </>
            )}
          </div>
        </div>
      )}
      
      <button
        onClick={onNewCheckIn}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700"
      >
        New Check-in
      </button>
    </div>
  );
}
