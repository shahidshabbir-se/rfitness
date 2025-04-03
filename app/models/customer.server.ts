import { prisma } from "~/utils/db.utils";
import { getEnv } from "~/utils/env.server";
import { initSquareClient, verifyMembership } from "~/utils/square.server";
import { Customer, SortedCustomers, Subscription, Payment } from "~/types/customers";

/**
 * Get a customer by ID
 */
export async function getCustomerById(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      checkIns: {
        orderBy: { checkInTime: "desc" },
        take: 10,
      },
    },
  });
}

/**
 * Get a customer by phone number
 */
export async function getCustomerByPhoneNumber(phoneNumber: string) {
  return prisma.customer.findFirst({
    where: { phoneNumber },
    include: {
      checkIns: {
        orderBy: { checkInTime: "desc" },
        take: 10,
      },
    },
  });
}

/**
 * Create a new customer or update if exists
 */
export async function upsertCustomer(customer: {
  id: string;
  name: string;
  phoneNumber?: string | null;
  membershipType?: string | null;
}) {
  return prisma.customer.upsert({
    where: { id: customer.id },
    update: {
      name: customer.name,
      phoneNumber: customer.phoneNumber,
      membershipType: customer.membershipType,
    },
    create: {
      id: customer.id,
      name: customer.name,
      phoneNumber: customer.phoneNumber,
      membershipType: customer.membershipType,
    },
  });
}

/**
 * Get all customers with pagination
 */
export async function getAllCustomers(page: number = 1, limit: number = 50) {
  const skip = (page - 1) * limit;

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      skip,
      take: limit,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { checkIns: true },
        },
      },
    }),
    prisma.customer.count(),
  ]);

  return {
    customers,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Search customers by name or phone number
 */
export async function searchCustomers(query: string, limit: number = 20) {
  return prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { phoneNumber: { contains: query } },
      ],
    },
    take: limit,
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { checkIns: true },
      },
    },
  });
}

/**
 * Get customer statistics
 */
export async function getCustomerStats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // Get total customers
  const totalCustomers = await prisma.customer.count();

  // Get active customers (checked in within last 30 days)
  const activeCustomers = await prisma.customer.count({
    where: {
      checkIns: {
        some: {
          checkInTime: {
            gte: thirtyDaysAgo,
          },
        },
      },
    },
  });

  // Get customers by membership type
  const membershipTypes = await prisma.customer.groupBy({
    by: ["membershipType"],
    _count: {
      id: true,
    },
  });

  return {
    totalCustomers,
    activeCustomers,
    membershipTypes: membershipTypes.map(
      (type: { membershipType: string | null; _count: { id: number } }) => ({
        type: type.membershipType || "Unknown",
        count: type._count.id,
      })
    ),
  };
}

/**
 * Get member metrics including retention rate and new members
 */
export async function getMemberMetrics(
  timeRange: "week" | "month" | "quarter" = "week"
): Promise<{
  newMembers: number;
  retentionRate: number;
  newMembersChange: string;
  retentionChange: string;
}> {
  const now = new Date();

  // Define time periods based on selected range
  let currentPeriodStart: Date;
  let previousPeriodStart: Date;
  let previousPeriodEnd: Date;
  let olderPeriodStart: Date;
  let olderPeriodEnd: Date;

  switch (timeRange) {
    case "month":
      // Current period: last 30 days
      currentPeriodStart = new Date(now);
      currentPeriodStart.setDate(now.getDate() - 30);

      // Previous period: 30-60 days ago
      previousPeriodStart = new Date(now);
      previousPeriodStart.setDate(now.getDate() - 60);
      previousPeriodEnd = new Date(currentPeriodStart);
      previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);

      // Older period: 60-90 days ago (for trend comparison)
      olderPeriodStart = new Date(now);
      olderPeriodStart.setDate(now.getDate() - 90);
      olderPeriodEnd = new Date(previousPeriodStart);
      olderPeriodEnd.setDate(olderPeriodEnd.getDate() - 1);
      break;

    case "quarter":
      // Current period: last 90 days
      currentPeriodStart = new Date(now);
      currentPeriodStart.setDate(now.getDate() - 90);

      // Previous period: 90-180 days ago
      previousPeriodStart = new Date(now);
      previousPeriodStart.setDate(now.getDate() - 180);
      previousPeriodEnd = new Date(currentPeriodStart);
      previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);

      // Older period: 180-270 days ago (for trend comparison)
      olderPeriodStart = new Date(now);
      olderPeriodStart.setDate(now.getDate() - 270);
      olderPeriodEnd = new Date(previousPeriodStart);
      olderPeriodEnd.setDate(olderPeriodEnd.getDate() - 1);
      break;

    case "week":
    default:
      // Current period: last 7 days
      currentPeriodStart = new Date(now);
      currentPeriodStart.setDate(now.getDate() - 7);

      // Previous period: 7-14 days ago
      previousPeriodStart = new Date(now);
      previousPeriodStart.setDate(now.getDate() - 14);
      previousPeriodEnd = new Date(currentPeriodStart);
      previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);

      // Older period: 14-21 days ago (for trend comparison)
      olderPeriodStart = new Date(now);
      olderPeriodStart.setDate(now.getDate() - 21);
      olderPeriodEnd = new Date(previousPeriodStart);
      olderPeriodEnd.setDate(olderPeriodEnd.getDate() - 1);
      break;
  }

  // Get new members (customers who checked in during current period but not in previous period)
  const newMembers = await prisma.customer.count({
    where: {
      checkIns: {
        some: {
          checkInTime: {
            gte: currentPeriodStart,
          },
        },
      },
      NOT: {
        checkIns: {
          some: {
            checkInTime: {
              lt: currentPeriodStart,
              gte: previousPeriodStart,
            },
          },
        },
      },
    },
  });

  // Get new members from previous period (for comparison)
  const previousNewMembers = await prisma.customer.count({
    where: {
      checkIns: {
        some: {
          checkInTime: {
            gte: previousPeriodStart,
            lt: currentPeriodStart,
          },
        },
      },
      NOT: {
        checkIns: {
          some: {
            checkInTime: {
              lt: previousPeriodStart,
              gte: olderPeriodStart,
            },
          },
        },
      },
    },
  });

  // Calculate retention rate
  // First, get members active in previous period
  const previousPeriodMembers = await prisma.customer.count({
    where: {
      checkIns: {
        some: {
          checkInTime: {
            gte: previousPeriodStart,
            lt: currentPeriodStart,
          },
        },
      },
    },
  });

  // Then, get members from previous period who are still active in current period
  const retainedMembers = await prisma.customer.count({
    where: {
      AND: [
        {
          checkIns: {
            some: {
              checkInTime: {
                gte: currentPeriodStart,
              },
            },
          },
        },
        {
          checkIns: {
            some: {
              checkInTime: {
                gte: previousPeriodStart,
                lt: currentPeriodStart,
              },
            },
          },
        },
      ],
    },
  });

  // Calculate retention rate
  const retentionRate =
    previousPeriodMembers > 0
      ? Math.round((retainedMembers / previousPeriodMembers) * 100)
      : 100;

  // Calculate previous retention rate for comparison
  const olderPeriodMembers = await prisma.customer.count({
    where: {
      checkIns: {
        some: {
          checkInTime: {
            gte: olderPeriodStart,
            lt: previousPeriodStart,
          },
        },
      },
    },
  });

  const previousRetainedMembers = await prisma.customer.count({
    where: {
      AND: [
        {
          checkIns: {
            some: {
              checkInTime: {
                gte: previousPeriodStart,
                lt: currentPeriodStart,
              },
            },
          },
        },
        {
          checkIns: {
            some: {
              checkInTime: {
                gte: olderPeriodStart,
                lt: previousPeriodStart,
              },
            },
          },
        },
      ],
    },
  });

  // Calculate previous retention rate
  const previousRetentionRate =
    olderPeriodMembers > 0
      ? Math.round((previousRetainedMembers / olderPeriodMembers) * 100)
      : 100;

  // Calculate changes
  const newMembersChange =
    previousNewMembers > 0
      ? `${Math.round(((newMembers - previousNewMembers) / previousNewMembers) * 100)}%`
      : "+0%";

  const retentionChange =
    previousRetentionRate > 0
      ? `${Math.round(((retentionRate - previousRetentionRate) / previousRetentionRate) * 100)}%`
      : "+0%";

  return {
    newMembers,
    retentionRate,
    newMembersChange: newMembersChange.startsWith("-")
      ? newMembersChange
      : `+${newMembersChange}`,
    retentionChange: retentionChange.startsWith("-")
      ? retentionChange
      : `+${retentionChange}`,
  };
}

async function fetchSquareSubscription(customerId: string) {
  const env = getEnv();
  const SQUARE_API_URL = `https://connect.squareup.com/v2/subscriptions/search`;

  try {
    const response = await fetch(SQUARE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          filter: {
            customer_ids: [customerId],
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Square subscriptions: ${response.statusText}`
      );
    }

    const data = await response.json();
    const subscription = data.subscriptions?.find(
      (sub: any) => sub.customer_id === customerId
    );

    return {
      membershipType: subscription ? "Subscription Based" : "Unknown",
      chargedThroughDate: subscription?.charged_through_date || null,
      status: subscription?.status || "INACTIVE",
    };
  } catch (error) {
    console.error("Error fetching subscription from Square:", error);
    return { membershipType: "Unknown", status: "INACTIVE" };
  }
}

async function fetchSquareCustomers() {
  const env = getEnv();
  const SQUARE_API_URL = "https://connect.squareup.com/v2/customers/search";
  try {
    const response = await fetch(SQUARE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Square customers: ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.customers || [];
  } catch (error) {
    console.error("Error fetching customers from Square:", error);
    return [];
  }
}

export async function syncCustomersWithPrisma() {
  const client = initSquareClient();
  let sortedCustomers: SortedCustomers[] = [];
  const getCustomersIds = async () => {
    try {
      const response = await client.customersApi.listCustomers();
      const customers: Customer[] = response.result.customers || [];
      for (const customer of customers) {
        await prisma.customer.upsert({
          where: { id: customer.id },
          update: {
            name: `${customer.givenName} ${customer.familyName}`,
            phoneNumber: customer.phoneNumber,
          },
          create: {
            id: customer.id,
            name: `${customer.givenName} ${customer.familyName}`,
            phoneNumber: customer.phoneNumber,
          },
        });
        //await upsertCustomer({
        //  id: customer.id,
        //  name: `${customer.givenName} ${customer.familyName}`,
        //  phoneNumber: customer.phoneNumber,
        //});
      }
      const customerIds: string[] = customers.map((customer: Customer) => customer.id);
      return customerIds;
    } catch (error) {
      console.error("Error fetching customer IDs");
    }
  }
  const customerIds = await getCustomersIds();
  if (customerIds && customerIds.length === 0) {
    console.log("⚠️ No customers found in Square API.");
    return;
  }

  const subscriptionMembersStatus = async (customerIds: string[]): Promise<{
    subscriptionBased: SortedCustomers[];
    cashBased: string[];
  }> => {
    try {
      const response = await client.subscriptionsApi.searchSubscriptions({
        query: {
          filter: {
            customerIds: customerIds
          }
        }
      });

      const subscriptionBasedCustomerData: SortedCustomers[] = response.result.subscriptions
        .filter((sub: Subscription) => sub.chargedThroughDate && (sub.status === 'ACTIVE' || sub.status === 'PENDING'))
        .map((sub: Subscription) => ({
          customerId: sub.customerId,
          nextPaymentDate: sub.chargedThroughDate,
          membershipStatus: "Subscription Based"
        }));

      const subscriptionBasedCustomerIds: string[] = subscriptionBasedCustomerData.map(data => data.customerId);
      const cashBasedCustomerIds = customerIds.filter(id => !subscriptionBasedCustomerIds.includes(id));

      return {
        subscriptionBased: subscriptionBasedCustomerData,
        cashBased: cashBasedCustomerIds
      };
    } catch (error) {
      console.log("Unexpected error occurred: ", error);
      return { subscriptionBased: [], cashBased: [] };
    }
  };
  const { subscriptionBased, cashBased } = await subscriptionMembersStatus(customerIds);
  sortedCustomers = subscriptionBased;
  // everything is above setuped right
  // now we need to check for cash based customers
  // and update their status
  for (const customerId of cashBased) {
    const status: SortedCustomers | null = await getLatestPaymentForCustomer(client, customerId);

    if (status && status.membershipStatus === "ACTIVE") {
      sortedCustomers.push({
        customerId,
        nextPaymentDate: status.nextPaymentDate,
        membershipStatus: "Cash Based",
      });
    }
  }
  for (const customer of sortedCustomers) {
    await prisma.customer.update({
      where: { id: customer.customerId },
      data: {
        membershipType: customer.membershipStatus,
        nextPayment: customer.nextPaymentDate,
      },
    });
  }
}

async function getLatestPaymentForCustomer(client: any, customerId: string): Promise<SortedCustomers | null> {
  if (!customerId) {
    console.error("Error: customerId is required.");
    return null;
  }

  try {
    const response = await client.paymentsApi.listPayments(
      undefined, // start time
      undefined, // end time
      'DESC', // sortOrder: DESC for latest payments first
      undefined, // cursor
      undefined, // locationId
      undefined, // total
      undefined, // last4
      undefined, // cardBrand
      100 // limit increased to get more payments
    );

    if (!response.result || !response.result.payments) {
      console.error("Error: Invalid response from API.");
      return null;
    }

    // Filter payments based on customerId and amount between 25 and 31 (assuming amount is in cents)
    const customerPayments = response.result.payments.filter(
      (payment: Payment) =>
        payment.customerId === customerId &&
        payment.amountMoney?.amount !== undefined &&
        payment.amountMoney?.amount >= 2500n &&  // Use `bigint` for comparison
        payment.amountMoney?.amount <= 3100n    // Use `bigint` for comparison
    );
    let notfoundPaymentCustomerIds = []
    if (customerPayments.length === 0) {
      notfoundPaymentCustomerIds.push(customerId);
      console.log("Not Found Payment Customer Ids: ", notfoundPaymentCustomerIds);
      return null;
    }

    // Get the latest payment (first item is the latest due to 'DESC' order)
    const latestPayment = customerPayments[0];

    // Check for the createdAt timestamp and convert it to a next payment date
    if (!latestPayment.createdAt || isNaN(new Date(latestPayment.createdAt).getTime())) {
      console.error("Error: Invalid or missing createdAt timestamp for latest payment.");
      return null;
    }

    // Use this payment's date as the next payment date (adding 1 month)
    const nextPaymentDate = new Date(latestPayment.createdAt);
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);


    // Return the sorted customer object
    const data: SortedCustomers = {
      customerId: latestPayment.customerId,
      nextPaymentDate: nextPaymentDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
      membershipStatus: 'ACTIVE',
    };

    return data;
  } catch (error) {
    console.error('Error fetching payments:', error);
    return null;
  }
}


// async function fetchSquareSubscription(customerId: string) {
//   const env = getEnv();
//   const SQUARE_API_URL = `https://connect.squareup.com/v2/subscriptions/search`;

//   try {
//     // Make a GET request to fetch subscriptions
//     const response = await fetch(SQUARE_API_URL, {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
//         Accept: "application/json",
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         query: {
//           filter: {
//             location_ids: [env.SQUARE_LOCATION_ID],
//             customer_ids: [customerId],
//           },
//         },
//       }),
//     });

//     if (!response.ok) {
//       throw new Error(
//         `Failed to fetch Square subscriptions: ${response.statusText}`
//       );
//     }

//     const data = await response.json();

//     // Find the subscription for the specific customer
//     const subscription = data.subscriptions?.find(
//       (sub: any) => sub.customer_id === customerId
//     );

//     return {
//       membershipType: subscription ? "Subscription Based" : "Unknown",
//       chargedThroughDate: subscription?.charged_through_date || null, // Return null if not available
//     };
//   } catch (error) {
//     console.error("Error fetching subscription from Square:", error);
//     return { membershipType: "Unknown" };
//   }
// }

function checkSubscriptionStatus(subscription) {
  // If there is no subscription data or its status is missing, return default inactive values
  if (!subscription || !subscription.status) {
    return {
      membershipStatus: "Inactive",
      expirationDate: "No Active Subscription", // No subscription found
      paymentStatus: "No Subscription Found", // No active payment
      nextPayment: "N/A", // No scheduled payment
    };
  }

  // Get today's date
  const today = new Date();
  // Convert the charged_through_date from Square API to a JavaScript Date object
  const chargedThroughDate = new Date(subscription.charged_through_date);
  // Calculate the next payment date (assumed to be the day after charged_through_date)
  const nextPaymentDate = new Date(chargedThroughDate);
  nextPaymentDate.setDate(chargedThroughDate.getDate() + 1);

  // Default payment status if the subscription status is unknown
  let paymentStatus = "Unknown";

  // If the subscription is active, check if the user is still within the paid period
  if (subscription.status === "ACTIVE") {
    paymentStatus = chargedThroughDate >= today ? "Paid" : "Past Due";
  }
  // If the subscription has been canceled, update the payment status accordingly
  else if (subscription.status === "CANCELED") {
    paymentStatus = "Canceled";
  }

  return {
    // Membership is active only if subscription status is "ACTIVE"
    membershipStatus: subscription.status === "ACTIVE" ? "Active" : "Inactive",
    // Expiration date is set to the charged_through_date
    // expirationDate: chargedThroughDate.toISOString(),
    // Payment status based on the subscription's current state
    paymentStatus: paymentStatus,
    // If the subscription is active, show the next payment date; otherwise, mark it as "N/A"
    nextPayment:
      subscription.status === "ACTIVE" ? nextPaymentDate.toISOString() : "N/A",
  };
}

async function checkCashMembershipStatus(customerId) {
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const formattedDate = thirtyDaysAgo.toISOString();

  const env = getEnv();
  const client = initSquareClient();
  const accessToken = env.SQUARE_ACCESS_TOKEN;

  try {
    const response = await client.paymentsApi.listPayments(
      formattedDate, // beginTime
      undefined, // endTime
      undefined, // sortOrder
      undefined, // cursor
      undefined, // locationId
      undefined, // total
      undefined, // last4
      undefined, // cardBrand
      undefined, // limit
      {
        customerId: customerId,
      }
    );

    const data = response.result;
    // console.log("Payments API Response:", data.payments);

    if (!data.payments || data.payments.length === 0) {
      return {
        membershipStatus: "Inactive",
        expirationDate: "No Recent Payment",
        paymentStatus: "No Payment Found",
      };
    }

    // // Filter payments based on amount and validity
    // Filter payments based on amount and validity
    const validPayments = data.payments.filter((payment) => {
      // Ensure amountMoney exists before accessing its properties
      if (
        !payment.amountMoney ||
        typeof payment.amountMoney.amount === "undefined"
      ) {
        console.warn("Skipping payment due to missing amountMoney:", payment);
        return false;
      }

      // Convert BigInt to Number safely
      const amountPaid = Number(payment.amountMoney.amount) / 100; // Convert cents to dollars

      // Ensure transaction is in the expected currency (e.g., USD)
      // Remove currency check if GBP payments are valid
      if (!["USD", "GBP"].includes(payment.amountMoney.currency)) {
        console.warn(
          "Skipping payment due to unsupported currency:",
          payment.amountMoney.currency
        );
        return false;
      }

      // Parse payment date
      const paymentDate = new Date(payment.createdAt);

      return (
        paymentDate >= thirtyDaysAgo &&
        paymentDate <= today &&
        amountPaid >= 25 &&
        amountPaid <= 31 &&
        payment.status !== "CANCELED" &&
        (!payment.refundIds || payment.refundIds.length === 0) && // Ensure not refunded
        !payment.refundedMoney // Ensure no refund amount
      );
    });

    if (validPayments.length === 0) {
      return {
        membershipStatus: "Inactive",
        expirationDate: "No Valid Payment Found",
        paymentStatus: "No Valid Payment",
      };
    }

    // Sort payments by creation date (latest first)
    validPayments.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    // Get latest payment
    const latestPayment = validPayments[0];
    const latestPaymentDate = new Date(latestPayment.createdAt);
    console.log("Latest Payment Date:", latestPaymentDate);
    if (isNaN(latestPaymentDate.getTime())) {
      console.error("Invalid latestPaymentDate:", latestPayment.created_at);
      return {
        membershipStatus: "Error",
        expirationDate: "Invalid Payment Date",
        paymentStatus: "Error Parsing Date",
      };
    }

    // Calculate expiration date (30 days after last payment)
    let expirationDate = new Date(latestPaymentDate);
    expirationDate.setUTCDate(latestPaymentDate.getUTCDate() + 30);

    // Check if membership is active
    const isActive = expirationDate >= today;
    return {
      membershipStatus: isActive ? "Active" : "Inactive",
      expirationDate: expirationDate.toISOString(),
      paymentStatus: isActive ? "Paid" : "Expired",
    };
  } catch (error) {
    console.error("Error fetching payments:", error);
    return {
      membershipStatus: "Error",
      expirationDate: "N/A",
      paymentStatus: "Error Fetching Payments",
      error: error.message,
    };
  }
}
