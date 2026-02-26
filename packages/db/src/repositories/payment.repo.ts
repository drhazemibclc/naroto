import type { Prisma } from '../../generated/browser';
import type { PrismaClient } from '../../generated/client';

/**
 * 🔷 PAYMENT ADMIN REPOSITORY
 * - ONLY raw Prisma queries
 * - NO business logic
 * - NO date calculations
 * - NO dedupeQuery
 */

export async function findPaymentById(db: PrismaClient, id: string) {
  return db.payment.findUnique({
    where: {
      id,
      isDeleted: false
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      },
      clinic: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
}
export async function sumPaymentsInRange(
  db: PrismaClient | Prisma.TransactionClient,
  clinicId: string,
  startDate: Date,
  endDate: Date
) {
  const result = await db.payment.aggregate({
    where: {
      clinicId,
      isDeleted: false,
      status: 'PAID', // Or your specific success status
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _sum: {
      amount: true
    }
  });

  return result._sum.amount ?? 0;
}

export async function findPaymentsInRange(
  db: PrismaClient | Prisma.TransactionClient,
  clinicId: string,
  startDate: Date,
  endDate: Date
) {
  return db.payment.findMany({
    where: {
      clinicId,
      paymentDate: {
        gte: startDate,
        lte: endDate
      },
      status: 'PAID',
      amount: {
        gt: 0
      },
      isDeleted: false
    },
    include: {
      bills: {
        include: {
          service: true
        }
      }
    }
  });
}

/**
 * Counts the number of payments currently in 'UNPAID' or 'PENDING' status.
 */
export async function countPendingPayments(db: PrismaClient | Prisma.TransactionClient, clinicId: string) {
  return db.payment.count({
    where: {
      clinicId,
      isDeleted: false,
      status: 'UNPAID' // Adjust based on your specific Enum values
    }
  });
}

/**
 * Optional: Get recent payment activity for dashboard feed
 */
export async function findRecentPayments(db: PrismaClient | Prisma.TransactionClient, clinicId: string, limit = 5) {
  return db.payment.findMany({
    where: {
      clinicId,
      isDeleted: false
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: limit,
    include: {
      patient: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  });
}

export async function findBillById(db: PrismaClient, id: string) {
  return db.patientBill.findUnique({
    where: { id },
    include: {
      payment: true,
      service: true
    }
  });
}

export async function updatePaymentStatus(
  db: PrismaClient,
  id: string,
  data: { status: 'REFUNDED' | 'PAID' | 'UNPAID'; updatedAt: Date }
) {
  return db.payment.update({
    where: { id },
    data
  });
}

export async function deletePayment(db: PrismaClient, id: string) {
  return db.payment.delete({
    where: { id }
  });
}

export async function deleteBill(db: PrismaClient, id: string) {
  return db.patientBill.delete({
    where: { id }
  });
}
