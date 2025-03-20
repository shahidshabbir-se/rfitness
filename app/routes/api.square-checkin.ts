import { json } from "@remix-run/node";
import type { ActionFunction } from "@remix-run/node";
import { getEnv } from "~/utils/env.server";

export const action: ActionFunction = async ({ request }) => {
  try {
    const env = getEnv();
    const { phoneNumber } = await request.json();

    // Step 1: Find Customer by Phone Number
    let response = await fetch(
      "https://connect.squareup.com/v2/customers/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: { filter: { phone_number: { exact: phoneNumber } } },
        }),
      }
    );

    let data = await response.json();

    if (!data.customers || data.customers.length === 0) {
      return json(
        { success: false, message: "Customer not found." },
        { status: 404 }
      );
    }

    let customerId = data.customers[0].id;

    // Step 2: Get Subscription Details
    response = await fetch(
      `https://connect.squareup.com/v2/subscriptions/search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
          "Square-Version": "2025-03-17",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: {
            filter: {
              location_ids: [env.SQUARE_LOCATION_ID],
              customer_ids: [customerId],
            },
          },
        }),
      }
    );

    data = await response.json();
    console.log(data);

    if (!data.subscriptions || data.subscriptions.length === 0) {
      return json(
        { success: false, message: "No active subscription found." },
        { status: 400 }
      );
    }

    let subscription = data.subscriptions[0];
    let subscriptionId = subscription.id;
    let chargedThroughDate = new Date(subscription.charged_through_date);
    let today = new Date();

    // Step 3: Check Latest Invoice
    response = await fetch("https://connect.squareup.com/v2/invoices/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
        "Square-Version": "2025-03-19",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          filter: {
            location_ids: [env.SQUARE_LOCATION_ID], // Ensure this is defined
            customer_ids: [customerId], // Use the correct customer ID
          },
          sort: {
            field: "INVOICE_SORT_DATE",
            order: "DESC", // Get the latest invoice first
          },
        },
        limit: 100, // Adjust limit if needed
      }),
    });

    data = await response.json();
    console.log("invoice details", data);

    if (!data.invoices || data.invoices.length === 0) {
      return json(
        { success: false, message: "No invoices found." },
        { status: 400 }
      );
    }

    let latestInvoice = data.invoices[0];
    let isPaid = latestInvoice.status === "PAID";
    let nextPaymentDue = new Date(latestInvoice.due_date);
    nextPaymentDue.setDate(nextPaymentDue.getDate() + 1); // Add 1 day for next payment

    // Step 4: Determine Check-in Status
    let checkInStatus =
      isPaid && chargedThroughDate >= today ? "Successful" : "Unsuccessful";

    // Step 5: Log Check-in Attempt
    let logEntry = {
      phone_number: phoneNumber,
      check_in_time: new Date().toISOString(),
      status: checkInStatus,
      next_payment_due: nextPaymentDue.toISOString().split("T")[0],
    };

    return json({ success: true, logEntry });
  } catch (error) {
    console.error("Error checking subscription:", error);
    return json(
      { success: false, message: "Error retrieving subscription details." },
      { status: 500 }
    );
  }
};
