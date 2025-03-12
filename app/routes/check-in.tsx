import { useState } from 'react';
import { Form } from "@remix-run/react";
import { json, redirect } from '@remix-run/node';
import { useActionData, useNavigation } from '@remix-run/react';
import type { ActionFunctionArgs } from '@remix-run/node';
import CheckInForm from '~/components/check-in/CheckInForm';
import CheckInResult from '~/components/check-in/CheckInResult';
import { verifyMembership } from '~/utils/square.server';
import { isSquareConfigured } from '~/utils/env.server';
import { logCheckIn } from '~/utils/system.server';
import type { CheckInResult as CheckInResultType } from '~/types';
import { processCheckIn } from '~/utils/check-in.server';
import type { CheckInRecord } from '~/types';

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
  const phoneNumber = formData.get('phoneNumber')?.toString() || '';

  // In a real app, you would:
  // 1. Validate the phone number
  // 2. Look up the customer in your database
  // 3. Check their membership status
  // 4. Process the check-in

  // For this example, we'll simulate a successful check-in
  const isSuccess = Math.random() > 0.2; // 80% success rate for demo

  // Create a check-in record
  const checkInData: CheckInRecord = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    customerName: isSuccess ? 'John Smith' : 'Unknown User',
    phoneNumber,
    success: isSuccess,
    membershipType: isSuccess ? 'Monthly Subscription (£25)' : '',
    message: isSuccess
      ? 'Check-in successful (Subscription)'
      : 'Member not found or payment required',
    nextPayment: isSuccess ? '15 Jun 2024' : '',
    initials: isSuccess ? 'JS' : 'UN'
  };

  // Process the check-in (this will emit the SSE event in production)
  processCheckIn(checkInData);

  return json({
    success: isSuccess,
    message: checkInData.message,
    checkInData
  });
}

export default function CheckIn() {
  const actionData = useActionData<typeof action>();
  const [phoneNumber, setPhoneNumber] = useState('');

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-lg bg-white p-6 shadow">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Gym Check-In</h1>

        <Form method="post">
          <div className="mb-4">
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              placeholder="+44 7700 123456"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Check In
          </button>
        </Form>

        {actionData && (
          <div className={`mt-6 rounded-md p-4 ${actionData.success ? 'bg-green-50' : 'bg-red-50'
            }`}>
            <p className={`text-sm font-medium ${actionData.success ? 'text-green-800' : 'text-red-800'
              }`}>
              {actionData.message}
            </p>

            {actionData.success && (
              <p className="mt-2 text-sm text-gray-600">
                Welcome, {actionData.checkInData.customerName}!
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
