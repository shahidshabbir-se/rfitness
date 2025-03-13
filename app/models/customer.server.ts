import { prisma } from '~/utils/db.utils';

/**
 * Get a customer by ID
 */
export async function getCustomerById(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      checkIns: {
        orderBy: { checkInTime: 'desc' },
        take: 10
      }
    }
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
        orderBy: { checkInTime: 'desc' },
        take: 10
      }
    }
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
      membershipType: customer.membershipType
    },
    create: {
      id: customer.id,
      name: customer.name,
      phoneNumber: customer.phoneNumber,
      membershipType: customer.membershipType
    }
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
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { checkIns: true }
        }
      }
    }),
    prisma.customer.count()
  ]);
  
  return {
    customers,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Search customers by name or phone number
 */
export async function searchCustomers(query: string, limit: number = 20) {
  return prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { phoneNumber: { contains: query } }
      ]
    },
    take: limit,
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { checkIns: true }
      }
    }
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
            gte: thirtyDaysAgo
          }
        }
      }
    }
  });
  
  // Get customers by membership type
  const membershipTypes = await prisma.customer.groupBy({
    by: ['membershipType'],
    _count: {
      id: true
    }
  });
  
  return {
    totalCustomers,
    activeCustomers,
    membershipTypes: membershipTypes.map((type: { membershipType: string | null; _count: { id: number } }) => ({
      type: type.membershipType || 'Unknown',
      count: type._count.id
    }))
  };
}

/**
 * Get member metrics including retention rate and new members
 */
export async function getMemberMetrics(timeRange: 'week' | 'month' | 'quarter' = 'week'): Promise<{
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
    case 'month':
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
      
    case 'quarter':
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
      
    case 'week':
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
            gte: currentPeriodStart
          }
        }
      },
      NOT: {
        checkIns: {
          some: {
            checkInTime: {
              lt: currentPeriodStart,
              gte: previousPeriodStart
            }
          }
        }
      }
    }
  });
  
  // Get new members from previous period (for comparison)
  const previousNewMembers = await prisma.customer.count({
    where: {
      checkIns: {
        some: {
          checkInTime: {
            gte: previousPeriodStart,
            lt: currentPeriodStart
          }
        }
      },
      NOT: {
        checkIns: {
          some: {
            checkInTime: {
              lt: previousPeriodStart,
              gte: olderPeriodStart
            }
          }
        }
      }
    }
  });
  
  // Calculate retention rate
  // First, get members active in previous period
  const previousPeriodMembers = await prisma.customer.count({
    where: {
      checkIns: {
        some: {
          checkInTime: {
            gte: previousPeriodStart,
            lt: currentPeriodStart
          }
        }
      }
    }
  });
  
  // Then, get members from previous period who are still active in current period
  const retainedMembers = await prisma.customer.count({
    where: {
      AND: [
        {
          checkIns: {
            some: {
              checkInTime: {
                gte: currentPeriodStart
              }
            }
          }
        },
        {
          checkIns: {
            some: {
              checkInTime: {
                gte: previousPeriodStart,
                lt: currentPeriodStart
              }
            }
          }
        }
      ]
    }
  });
  
  // Calculate retention rate
  const retentionRate = previousPeriodMembers > 0 
    ? Math.round((retainedMembers / previousPeriodMembers) * 100) 
    : 100;
    
  // Calculate previous retention rate for comparison
  const olderPeriodMembers = await prisma.customer.count({
    where: {
      checkIns: {
        some: {
          checkInTime: {
            gte: olderPeriodStart,
            lt: previousPeriodStart
          }
        }
      }
    }
  });
  
  const previousRetainedMembers = await prisma.customer.count({
    where: {
      AND: [
        {
          checkIns: {
            some: {
              checkInTime: {
                gte: previousPeriodStart,
                lt: currentPeriodStart
              }
            }
          }
        },
        {
          checkIns: {
            some: {
              checkInTime: {
                gte: olderPeriodStart,
                lt: previousPeriodStart
              }
            }
          }
        }
      ]
    }
  });
  
  // Calculate previous retention rate
  const previousRetentionRate = olderPeriodMembers > 0 
    ? Math.round((previousRetainedMembers / olderPeriodMembers) * 100) 
    : 100;
  
  // Calculate changes
  const newMembersChange = previousNewMembers > 0 
    ? `${Math.round(((newMembers - previousNewMembers) / previousNewMembers) * 100)}%` 
    : '+0%';
    
  const retentionChange = previousRetentionRate > 0 
    ? `${Math.round(((retentionRate - previousRetentionRate) / previousRetentionRate) * 100)}%` 
    : '+0%';
  
  return {
    newMembers,
    retentionRate,
    newMembersChange: newMembersChange.startsWith('-') ? newMembersChange : `+${newMembersChange}`,
    retentionChange: retentionChange.startsWith('-') ? retentionChange : `+${retentionChange}`
  };
} 