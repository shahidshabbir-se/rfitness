import { Form } from '@remix-run/react';

interface CheckInFormProps {
  isSubmitting: boolean;
  onSubmit: () => void;
}

export default function CheckInForm({ isSubmitting, onSubmit }: CheckInFormProps) {
  return (
    <Form method="post" onSubmit={onSubmit}>
      <div className="mb-4">
        <label htmlFor="phoneNumber" className="mb-2 block text-sm font-medium text-gray-700">
          Mobile Number
        </label>
        <input
          type="tel"
          id="phoneNumber"
          name="phoneNumber"
          className="w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="07XXXXXXXXX or +447XXXXXXXXX"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          Enter your UK mobile number (e.g., 07123456789)
        </p>
      </div>
      
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:bg-blue-400"
      >
        {isSubmitting ? 'Checking...' : 'Check In'}
      </button>
    </Form>
  );
}
