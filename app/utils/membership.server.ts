import type { CheckInResult } from "~/types";
import { formatCustomerData } from "./formatters.server";
import { getEnv } from "./env.server";

/**
 * Validates a customer's subscription status
 */
export function validateSubscription(
  customer: any,
  subscription: any
): CheckInResult {
  // Check if there are any payment issues
  const paymentStatus = subscription.charged_through_date
    ? new Date(subscription.charged_through_date) < new Date()
      ? "Payment overdue"
      : "Current"
    : "Unknown";

  return {
    success: paymentStatus === "Current",
    message:
      paymentStatus === "Current"
        ? "Check-in successful (Subscription)"
        : "Payment issue detected",
    customerData: formatCustomerData(customer, {
      membershipStatus: "Active",
      expirationDate: subscription.charged_through_date,
      paymentStatus,
    }),
  };
}

/**
 * Validates a customer's cash payment
 */
export function validateCashPayment(
  customer: any,
  payment: any
): CheckInResult {
  const paymentDate = payment.createdAt ? new Date(payment.createdAt) : null;

  return {
    success: true,
    message: "Check-in successful (Cash payment)",
    customerData: formatCustomerData(customer, {
      membershipStatus: "Active",
      expirationDate: paymentDate
        ? new Date(
            paymentDate.getTime() + 30 * 24 * 60 * 60 * 1000
          ).toISOString()
        : undefined,
      paymentStatus: "Cash payment verified",
    }),
  };
}
