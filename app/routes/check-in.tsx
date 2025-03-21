import { useState } from "react";
import { json, redirect } from "@remix-run/node";
import { useActionData, useNavigation } from "@remix-run/react";
import type { ActionFunctionArgs } from "@remix-run/node";
import CheckInForm from "~/components/check-in/CheckInForm";
import CheckInResult from "~/components/check-in/CheckInResult";
import Logo from "~/components/common/Logo";
import { verifyMembership } from "~/utils/square.server";
import { isSquareConfigured, getEnv } from "~/utils/env.server";
import { createSystemLog } from "~/models/system-log.server";
import { createCheckIn } from "~/models/check-in.server";
import {
  getCustomerByPhoneNumber,
  upsertCustomer,
} from "~/models/customer.server";
import type { CheckInResult as CheckInResultType } from "~/types";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  let phoneNumber = formData.get("phoneNumber") as string;
  const env = getEnv();
  const locationId = env.SQUARE_LOCATION_ID || "default-location";

  if (!phoneNumber) {
    await createSystemLog({
      message: "Check-in attempt failed: Missing phone number",
      eventType: "check_in_error",
      severity: "warning",
      details: { error: "MISSING_PHONE_NUMBER" },
    });
    return json({
      success: false,
      message: "Phone number is required",
      error: "MISSING_PHONE_NUMBER",
    });
  }

  // Normalize phone number format
  phoneNumber = phoneNumber.replace(/\D/g, "");
  if (phoneNumber.startsWith("0") && phoneNumber.length === 11) {
    phoneNumber = "+44" + phoneNumber.substring(1);
  } else if (phoneNumber.startsWith("44") && phoneNumber.length === 12) {
    phoneNumber = "+" + phoneNumber;
  } else if (!phoneNumber.startsWith("+")) {
    phoneNumber = "+44" + phoneNumber;
  }

  try {
    const customer = await getCustomerByPhoneNumber(phoneNumber);

    if (!customer) {
      return json({
        success: false,
        message: "No customer found with this phone number",
        error: "CUSTOMER_NOT_FOUND",
      });
    }

    const nextPaymentDate = customer.nextPayment
      ? new Date(customer.nextPayment)
      : null;
    const today = new Date();

    // Determine if the membership is active
    const isActive =
      (customer.membershipType === "Subscription Based" &&
        nextPaymentDate &&
        nextPaymentDate >= today) ||
      (customer.membershipType === "Cash Payment Based" &&
        nextPaymentDate &&
        nextPaymentDate >= today);

    if (!isActive) {
      return json({
        success: false,
        message: "No active membership found",
        error: "NO_ACTIVE_MEMBERSHIP",
      });
    }

    const checkIn = await createCheckIn({
      customerId: customer.id,
      customerName: customer.name,
      phoneNumber: customer.phoneNumber,
      membershipType: customer.membershipType,
      locationId,
    });

    await createSystemLog({
      message: `Check-in successful for ${customer.name}`,
      eventType: "check_in",
      severity: "info",
      details: {
        customerId: customer.id,
        phoneNumber,
        membershipType: customer.membershipType,
      },
    });

    return json({
      success: true,
      message: "Check-in successful! Welcome back.",
      customerData: {
        id: customer.id,
        name: customer.name,
        membershipStatus: "Active",
        expirationDate: nextPaymentDate ? nextPaymentDate.toISOString() : "",
        paymentStatus:
          customer.membershipType === "Subscription Based"
            ? "Subscription Active"
            : "Recent Cash Payment",
      },
    });
  } catch (error) {
    await createSystemLog({
      message: `Error during check-in: ${(error as Error).message}`,
      eventType: "check_in_error",
      severity: "error",
      details: {
        phoneNumber,
        error: (error as Error).stack,
      },
    });
    return json({
      success: false,
      message: "An unexpected error occurred. Please try again.",
      error: "UNEXPECTED_ERROR",
    });
  }
}

export default function CheckInPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [showResult, setShowResult] = useState(false);
  const isSubmitting = navigation.state === "submitting";

  if (actionData && !isSubmitting && !showResult) {
    setShowResult(true);
  }

  const handleNewCheckIn = () => {
    setShowResult(false);
    window.location.href = "/check-in";
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-4">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full rounded-lg bg-white p-6 shadow-lg">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">
          {showResult ? "Check-In Result" : "Member Check-In"}
        </h1>
        {showResult && actionData ? (
          <CheckInResult
            result={actionData as CheckInResultType}
            onNewCheckIn={handleNewCheckIn}
          />
        ) : (
          <CheckInForm isSubmitting={isSubmitting} onSubmit={() => {}} />
        )}
      </div>
    </div>
  );
}
