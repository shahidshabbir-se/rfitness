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
 * Get peak hours data for check-ins
 */
export async function getCheckInPeakHours(timeRange: 'week' | 'month' | 'quarter' = 'week'): Promise<Array<{ hour: string; count: number }>> {
  // Determine date range based on selected time range
  const now = new Date();
  let startDate: Date;
  
  switch (timeRange) {
    case 'month':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
      break;
    case 'quarter':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 90);
      break;
    case 'week':
    default:
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      break;
  }
  
  // Get check-ins grouped by hour
  const checkInsByHour = await prisma.$queryRaw<Array<{ hour: string; count: number }>>`
    SELECT 
      to_char("checkInTime", 'HH24:00-HH24:59') as hour,
      COUNT(*) as count
    FROM "CheckIn"
    WHERE "checkInTime" >= ${startDate}
    GROUP BY hour
    ORDER BY count DESC
    LIMIT 5
  `;
  
  return checkInsByHour;
}

/**
 * Get check-ins by day of week
 */
export async function getCheckInsByDayOfWeek(timeRange: 'week' | 'month' | 'quarter' = 'week'): Promise<Array<{ date: string; count: number }>> {
  // Determine date range based on selected time range
  const now = new Date();
  let startDate: Date;
  let groupBy: string;
  
  switch (timeRange) {
    case 'month':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
      // For month view, we'll group by day of week
      groupBy = 'day_of_week';
      break;
    case 'quarter':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 90);
      // For quarter view, we'll group by day of week
      groupBy = 'day_of_week';
      break;
    case 'week':
    default:
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      // For week view, we'll group by day of week
      groupBy = 'day_of_week';
      break;
  }
  
  // Get check-ins grouped by day of week
  const checkInsByDay = await prisma.$queryRaw<Array<{ date: string; count: number }>>`
    SELECT 
      to_char("checkInTime", 'Dy') as date,
      COUNT(*) as count
    FROM "CheckIn"
    WHERE "checkInTime" >= ${startDate}
    GROUP BY date
    ORDER BY CASE
      WHEN date = 'Mon' THEN 1
      WHEN date = 'Tue' THEN 2
      WHEN date = 'Wed' THEN 3
      WHEN date = 'Thu' THEN 4
      WHEN date = 'Fri' THEN 5
      WHEN date = 'Sat' THEN 6
      WHEN date = 'Sun' THEN 7
    END
  `;
  
  // Ensure we have all days of the week, even if there are no check-ins
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const result = daysOfWeek.map(day => {
    const found = checkInsByDay.find((item: { date: string; count: number }) => item.date === day);
    return found || { date: day, count: 0 };
  });
  
  return result;
}

/**
 * Delete a check-in record
 */
export async function deleteCheckIn(id: number): Promise<void> {
  await prisma.checkIn.delete({
    where: { id }
  });
} 