import { useState } from 'react';
import { json, redirect } from '@remix-run/node';
import { useActionData, useNavigation } from '@remix-run/react';
import type { ActionFunctionArgs } from '@remix-run/node';
import CheckInForm from '~/components/check-in/CheckInForm';
import CheckInResult from '~/components/check-in/CheckInResult';
import { verifyMembership } from '~/utils/square.server';
import { isSquareConfigured } from '~/utils/env.server';
import { logCheckIn } from '~/utils/system.server';
import type { CheckInResult as CheckInResultType } from '~/types';

// Mock data for development when Square is not configured
const MOCK_SUCCESS_RESULT: CheckInResultType = {
  success: true,
  message: 'Check-in successful! Welcome back.',
  customerData: {
    id: 'mock-id',
    name: 'John Doe',
    membershipStatus: 'Active',
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    paymentStatus: 'Subscription Active'
  }
};

const MOCK_FAILURE_RESULT: CheckInResultType = {
  success: false,
  message: 'No active membership found',
  error: 'NO_ACTIVE_MEMBERSHIP',
  customerData: {
    id: 'mock-id',
    name: 'Jane Smith',
    membershipStatus: 'Inactive',
    paymentStatus: 'No active subscription or recent payment'
  }
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const phoneNumber = formData.get('phoneNumber') as string;

  if (!phoneNumber) {
    return json({ 
      success: false, 
      message: 'Phone number is required',
      error: 'MISSING_PHONE_NUMBER'
    });
  }

  try {
    // Check if Square is configured
    if (!isSquareConfigured()) {
      console.log('Square not configured, using mock data');
      // Use mock data for development
      const mockResult = Math.random() > 0.3 ? MOCK_SUCCESS_RESULT : MOCK_FAILURE_RESULT;
      
      // Log the check-in
      if (mockResult.customerData?.name) {
        logCheckIn(mockResult.customerData.name, mockResult.success);
      }
      
      return json(mockResult);
    }

    // Verify membership with Square API
    const result = await verifyMembership(phoneNumber);
    
    // Log the check-in
    if (result.customerData?.name) {
      logCheckIn(result.customerData.name, result.success);
    }
    
    return json(result);
  } catch (error) {
    console.error('Error in check-in action:', error);
    return json({ 
      success: false, 
      message: 'An unexpected error occurred. Please try again.',
      error: 'UNEXPECTED_ERROR'
    });
  }
}

export default function CheckInPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [showResult, setShowResult] = useState(false);

  const isSubmitting = navigation.state === 'submitting';

  // Show result when data is available and not submitting
  if (actionData && !isSubmitting && !showResult) {
    setShowResult(true);
  }

  // Reset when starting a new check-in
  const handleNewCheckIn = () => {
    setShowResult(false);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-4">
      <div className="mb-8 w-48">
        <img src="/logo-light.png" alt="Gym Logo" className="w-full" />
      </div>
      
      <div className="w-full rounded-lg bg-white p-6 shadow-lg">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">
          {showResult ? 'Check-In Result' : 'Member Check-In'}
        </h1>
        
        {showResult && actionData ? (
          <CheckInResult 
            result={actionData as CheckInResultType} 
            onNewCheckIn={handleNewCheckIn} 
          />
        ) : (
          <CheckInForm 
            isSubmitting={isSubmitting} 
            onSubmit={() => {}} 
          />
        )}
      </div>
    </div>
  );
}
