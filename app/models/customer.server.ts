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