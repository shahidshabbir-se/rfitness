import type { CheckIn } from '~/types';
import { prisma } from '~/utils/db.utils';

/**
 * Create a new check-in record
 */
export async function createCheckIn({
  customerId,
  customerName,
  phoneNumber,
  membershipType,
  locationId,
  verifiedBy
}: {
  customerId: string;
  customerName?: string | null;
  phoneNumber?: string | null;
  membershipType?: string | null;
  locationId?: string | null;
  verifiedBy?: number | null;
}) {
  return prisma.checkIn.create({
    data: {
      customerId,
      customerName,
      phoneNumber,
      membershipType,
      locationId,
      verifiedBy,
      checkInTime: new Date()
    },
    include: {
      customer: true,
      verifiedUser: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
}

/**
 * Get recent check-ins with pagination
 */
export async function getRecentCheckIns(page: number = 1, limit: number = 50) {
  const skip = (page - 1) * limit;
  
  const [checkIns, total] = await Promise.all([
    prisma.checkIn.findMany({
      skip,
      take: limit,
      orderBy: { checkInTime: 'desc' },
      include: {
        customer: true,
        verifiedUser: {
          select: {
            id: true,
            name: true
          }
        }
      }
    }),
    prisma.checkIn.count()
  ]);
  
  return {
    checkIns,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get check-ins for a specific customer
 */
export async function getCheckInsByCustomerId(customerId: string): Promise<CheckIn[]> {
  return prisma.checkIn.findMany({
    where: { customerId },
    orderBy: { checkInTime: 'desc' },
    include: {
      verifiedUser: true
    }
  });
}

/**
 * Get check-ins by date range
 */
export async function getCheckInsByDateRange(startDate: Date, endDate: Date): Promise<CheckIn[]> {
  return prisma.checkIn.findMany({
    where: {
      checkInTime: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: { checkInTime: 'desc' },
    include: {
      customer: true,
      verifiedUser: true
    }
  });
}

/**
 * Get check-in statistics
 */
export async function getCheckInStats(): Promise<{ 
  total: number; 
  today: number;
  thisWeek: number;
  thisMonth: number;
}> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const [total, today, thisWeek, thisMonth] = await Promise.all([
    prisma.checkIn.count(),
    prisma.checkIn.count({
      where: { checkInTime: { gte: startOfDay } }
    }),
    prisma.checkIn.count({
      where: { checkInTime: { gte: startOfWeek } }
    }),
    prisma.checkIn.count({
      where: { checkInTime: { gte: startOfMonth } }
    })
  ]);
  
  return { total, today, thisWeek, thisMonth };
}

/**
 * Delete a check-in record
 */
export async function deleteCheckIn(id: number): Promise<void> {
  await prisma.checkIn.delete({
    where: { id }
  });
} 