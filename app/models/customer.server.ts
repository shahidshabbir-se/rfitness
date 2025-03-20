import { prisma } from "~/utils/db.utils";
import { getEnv } from "~/utils/env.server";
import { verifyMembership } from "~/utils/square.server";

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

// async function fetchSquareCustomers() {
//   const env = getEnv();
//   const SQUARE_API_URL = "https://connect.squareup.com/v2/customers";
//   try {
//     const response = await fetch(SQUARE_API_URL, {
//       method: "GET",
//       headers: {
//         Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
//         Accept: "application/json",
//         "Content-Type": "application/json",
//       },
//     });

//     if (!response.ok) {
//       throw new Error(
//         `Failed to fetch Square customers: ${response.statusText}`
//       );
//     }

//     const data = await response.json();
//     return data.customers || [];
//   } catch (error) {
//     console.error("Error fetching customers from Square:", error);
//     return [];
//   }
// }

// export async function syncCustomersWithPrisma() {
//   const customers = await fetchSquareCustomers();

//   if (customers.length === 0) {
//     console.log("No customers found in Square API.");
//     return;
//   }

//   // Transform Square data to match Prisma schema
//   const customerData =  customers.map((customer: any) => ({
//     id: customer.id, // Use Square's customer ID
//     name:
//       `${customer.given_name || ""} ${customer.family_name || ""}`.trim() ||
//       "Unknown",
//     phoneNumber: customer.phone_number || null,
//     membershipType: await updateMemberShip(customer.id),
//   }));

//   try {
//     await prisma.customer.createMany({
//       data: customerData,
//       skipDuplicates: true, // Avoid inserting duplicate customers
//     });

//     console.log(`${customerData.length} customers synced with Prisma.`);
//   } catch (error) {
//     console.error("Error syncing customers with Prisma:", error);
//   }
// }

// async function fetchSquareSubscription(customerId: string) {
//   const env = getEnv();
//   const SQUARE_API_URL = `https://connect.squareup.com/v2/customers/`;

//   try {
//     // make a post request with location id
//     const response = await fetch(
//       `${SQUARE_API_URL}${customerId}/subscriptions`,
//       {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
//           Accept: "application/json",
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           query: {
//             filter: {
//               location_ids: [env.SQUARE_LOCATION_ID],
//               customer_ids: [customerId],
//             },
//           },
//         }),
//       }
//     );
//     if (!response.ok) {
//       throw new Error(
//         `Failed to fetch Square subscription: ${response.statusText}`
//       );
//     }
//     const data = await response.json();
//     if (data.subscriptions.charged_through_date) {
//       return {
//         membershipType: "Subscription Based",
//         expirationDate: data.subscriptions.charged_through_date,
//       };
//     }
//   } catch (error) {
//     console.error("Error fetching subscription from Square:", error);
//     return {};
//   }
// }

// export async function updateMemberShip(customerId: string) {
//   const customer = await prisma.customer.findUnique({
//     where: { id: customerId },
//   });

//   if (!customer) {
//     throw new Error(`Customer with ID ${customerId} not found.`);
//   }

//   const customerSubscription = await fetchSquareSubscription(customerId);

//   const updatedCustomer = await prisma.customer.update({
//     where: { id: customerId },
//     data: {
//       membershipType: customerSubscription?.membershipType || "Unknown",
//     },
//   });

//   return updatedCustomer;
// }

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
  const customers = await fetchSquareCustomers();

  if (customers.length === 0) {
    console.log("No customers found in Square API.");
    return;
  }

  // Use Promise.all to handle async operations inside map
  const customerData = await Promise.all(
    customers.map(async (customer: any) => {
      let membershipType = "Unknown";
      let nextPayment = null;

      // Check if customer is subscription-based
      if (customer.membershipType?.includes("Subscription")) {
        const subscriptionData = await updateMemberShip(customer.id);
        membershipType = subscriptionData.membershipType;
        nextPayment = subscriptionData.chargedThroughDate;
      } else if (customer.phone_number) {
        // For cash-based customers, verify membership using phone number
        const verifiedData = await verifyMembership(customer.phone_number);
        console.log(verifiedData);
        // if (verifiedData) {
        //   membershipType = verifiedData.membershipType;
        //   nextPayment = verifiedData.expirationDate; // Use expiration date as next payment
        // }
      }

      return {
        id: customer.id, // Use Square's customer ID
        name:
          `${customer.given_name || ""} ${customer.family_name || ""}`.trim() ||
          "Unknown",
        phoneNumber: customer.phone_number || null,
        membershipType, // Updated membership type
        nextPayment, // Updated next payment
      };
    })
  );

  try {
    await prisma.customer.createMany({
      data: customerData,
      skipDuplicates: true, // Avoid inserting duplicate customers
    });

    console.log(`${customerData.length} customers synced with Prisma.`);
  } catch (error) {
    console.error("Error syncing customers with Prisma:", error);
  }
}

async function fetchSquareSubscription(customerId: string) {
  const env = getEnv();
  const SQUARE_API_URL = `https://connect.squareup.com/v2/subscriptions/search`;

  try {
    // Make a GET request to fetch subscriptions
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
            location_ids: [env.SQUARE_LOCATION_ID],
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

    // Find the subscription for the specific customer
    const subscription = data.subscriptions?.find(
      (sub: any) => sub.customer_id === customerId
    );

    return {
      membershipType: subscription ? "Subscription Based" : "Unknown",
      chargedThroughDate: subscription?.charged_through_date || null, // Return null if not available
    };
  } catch (error) {
    console.error("Error fetching subscription from Square:", error);
    return { membershipType: "Unknown" };
  }
}

export async function updateMemberShip(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    throw new Error(`Customer with ID ${customerId} not found.`);
  }

  const { membershipType, chargedThroughDate } =
    await fetchSquareSubscription(customerId);

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      membershipType,
      nextPayment: chargedThroughDate, // Ensure this exists in your Prisma schema
    },
  });

  return { membershipType, chargedThroughDate }; // Return both values
}
