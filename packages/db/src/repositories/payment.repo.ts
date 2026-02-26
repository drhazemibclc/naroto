import type { Prisma } from '../../generated/browser';
import type { PrismaClient } from '../../generated/client';

/**
 * 🔷 PAYMENT ADMIN REPOSITORY
 * - ONLY raw Prisma queries
 * - NO business logic
 * - NO date calculations
 * - NO dedupeQuery
 */

// ==================== READ OPERATIONS ====================

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
      },
      bills: {
        include: {
          service: true
        }
      }
    }
  });
}

export async function findPaymentsByAppointment(db: PrismaClient | Prisma.TransactionClient, appointmentId: string) {
  return db.payment.findMany({
    where: {
      appointmentId,
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

export async function findPaymentsByPatient(
  db: PrismaClient | Prisma.TransactionClient,
  patientId: string,
  clinicId: string,
  options?: {
    limit?: number;
    offset?: number;
    status?: 'PAID' | 'UNPAID' | 'REFUNDED' | 'PARTIAL';
    fromDate?: Date;
    toDate?: Date;
  }
) {
  const where: Prisma.PaymentWhereInput = {
    patientId,
    clinicId,
    isDeleted: false
  };

  if (options?.status) {
    where.status = options.status;
  }

  if (options?.fromDate || options?.toDate) {
    where.paymentDate = {};
    if (options.fromDate) where.paymentDate.gte = options.fromDate;
    if (options.toDate) where.paymentDate.lte = options.toDate;
  }

  return db.payment.findMany({
    where,
    orderBy: { paymentDate: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
    include: {
      bills: {
        include: {
          service: true
        }
      }
    }
  });
}

export async function findPaymentsPaginated(
  db: PrismaClient | Prisma.TransactionClient,
  params: {
    clinicId: string;
    search?: string;
    skip: number;
    take: number;
    status?: 'PAID' | 'UNPAID' | 'REFUNDED' | 'PARTIAL';
    fromDate?: Date;
    toDate?: Date;
  }
) {
  const { clinicId, search, skip, take, status, fromDate, toDate } = params;

  const where: Prisma.PaymentWhereInput = {
    clinicId,
    isDeleted: false
  };

  if (status) {
    where.status = status;
  }

  if (fromDate || toDate) {
    where.paymentDate = {};
    if (fromDate) where.paymentDate.gte = fromDate;
    if (toDate) where.paymentDate.lte = toDate;
  }

  if (search) {
    where.OR = [
      {
        patient: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } }
          ]
        }
      },
      { patientId: { contains: search, mode: 'insensitive' } },
      { id: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [data, total] = await Promise.all([
    db.payment.findMany({
      where,
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            image: true,
            colorCode: true,
            gender: true
          }
        },
        bills: {
          include: {
            service: true
          }
        }
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' }
    }),
    db.payment.count({ where })
  ]);

  return [data, total] as const;
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
      status: 'PAID',
      paymentDate: {
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
      },
      patient: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  });
}

export async function countPaymentsByStatus(
  db: PrismaClient | Prisma.TransactionClient,
  clinicId: string,
  status: 'PAID' | 'UNPAID' | 'REFUNDED' | 'PARTIAL'
) {
  return db.payment.count({
    where: {
      clinicId,
      isDeleted: false,
      status
    }
  });
}

export async function countPendingPayments(db: PrismaClient | Prisma.TransactionClient, clinicId: string) {
  return db.payment.count({
    where: {
      clinicId,
      isDeleted: false,
      status: 'UNPAID'
    }
  });
}

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
      },
      bills: {
        include: {
          service: true
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

export async function findBillsByPayment(db: PrismaClient | Prisma.TransactionClient, paymentId: string) {
  return db.patientBill.findMany({
    where: { billId: paymentId },
    include: {
      service: true
    }
  });
}

// ==================== WRITE OPERATIONS ====================

export async function createPayment(
  db: PrismaClient | Prisma.TransactionClient,
  data: {
    id: string;
    appointmentId: string;
    patientId: string;
    clinicId: string;
    billDate: Date;
    paymentDate: Date;
    discount: number;
    amountPaid: number;
    totalAmount: number;
    status?: 'PAID' | 'UNPAID' | 'REFUNDED' | 'PARTIAL';
    createdAt: Date;
    updatedAt: Date;
  }
) {
  return db.payment.create({
    data: {
      ...data,
      status: data.status || 'UNPAID'
    }
  });
}

export async function updatePayment(
  db: PrismaClient | Prisma.TransactionClient,
  id: string,
  data: Partial<{
    billDate: Date;
    paymentDate: Date;
    discount: number;
    amountPaid: number;
    totalAmount: number;
    status: 'PAID' | 'UNPAID' | 'REFUNDED' | 'PARTIAL';
    updatedAt: Date;
  }>
) {
  return db.payment.update({
    where: { id },
    data
  });
}

export async function updatePaymentStatus(
  db: PrismaClient | Prisma.TransactionClient,
  id: string,
  data: { status: 'REFUNDED' | 'PAID' | 'UNPAID' | 'PARTIAL'; updatedAt: Date }
) {
  return db.payment.update({
    where: { id },
    data
  });
}

export async function createBillItem(
  db: PrismaClient | Prisma.TransactionClient,
  data: {
    id: string;
    billId: string;
    serviceId: string;
    serviceDate: Date;
    quantity: number;
    unitCost: number;
    totalCost: number;
    createdAt: Date;
    updatedAt: Date;
  }
) {
  return db.patientBill.create({
    data,
    include: {
      service: true
    }
  });
}

export async function updateBillItem(
  db: PrismaClient | Prisma.TransactionClient,
  id: string,
  data: Partial<{
    quantity: number;
    unitCost: number;
    totalCost: number;
    updatedAt: Date;
  }>
) {
  return db.patientBill.update({
    where: { id },
    data,
    include: {
      service: true
    }
  });
}

export async function deletePayment(db: PrismaClient, id: string) {
  return db.payment.delete({
    where: { id }
  });
}

export async function softDeletePayment(
  db: PrismaClient | Prisma.TransactionClient,
  id: string,
  data: {
    isDeleted: boolean;
    deletedAt: Date;
    updatedAt: Date;
  }
) {
  return db.payment.update({
    where: { id },
    data
  });
}

export async function deleteBill(db: PrismaClient, id: string) {
  return db.patientBill.delete({
    where: { id }
  });
}

export async function deleteBillsByPayment(db: PrismaClient | Prisma.TransactionClient, paymentId: string) {
  return db.patientBill.deleteMany({
    where: { billId: paymentId }
  });
}

// ==================== AGGREGATIONS ====================

export async function getPaymentSummary(
  db: PrismaClient | Prisma.TransactionClient,
  clinicId: string,
  startDate: Date,
  endDate: Date
) {
  const [totalRevenue, paidCount, unpaidCount, refundedCount] = await Promise.all([
    db.payment.aggregate({
      where: {
        clinicId,
        isDeleted: false,
        status: 'PAID',
        paymentDate: {
          gte: startDate,
          lte: endDate
        }
      },
      _sum: { amount: true }
    }),
    db.payment.count({
      where: {
        clinicId,
        isDeleted: false,
        status: 'PAID',
        paymentDate: {
          gte: startDate,
          lte: endDate
        }
      }
    }),
    db.payment.count({
      where: {
        clinicId,
        isDeleted: false,
        status: 'UNPAID',
        paymentDate: {
          gte: startDate,
          lte: endDate
        }
      }
    }),
    db.payment.count({
      where: {
        clinicId,
        isDeleted: false,
        status: 'REFUNDED',
        paymentDate: {
          gte: startDate,
          lte: endDate
        }
      }
    })
  ]);

  return {
    totalRevenue: totalRevenue._sum.amount ?? 0,
    paidCount,
    unpaidCount,
    refundedCount,
    totalCount: paidCount + unpaidCount + refundedCount
  };
}

export async function getRevenueByService(
  db: PrismaClient | Prisma.TransactionClient,
  clinicId: string,
  startDate: Date,
  endDate: Date
) {
  const results = await db.$queryRaw<Array<{ serviceName: string; revenue: number; count: number }>>`
    SELECT 
      s."serviceName",
      SUM(pb."totalCost") as revenue,
      COUNT(pb.id) as count
    FROM "PatientBill" pb
    JOIN "Service" s ON s.id = pb."serviceId"
    JOIN "Payment" p ON p.id = pb."billId"
    WHERE p."clinicId" = ${clinicId}
      AND p.status = 'PAID'
      AND p."paymentDate" >= ${startDate}
      AND p."paymentDate" <= ${endDate}
      AND p."isDeleted" = false
    GROUP BY s.id, s."serviceName"
    ORDER BY revenue DESC
  `;

  return results.map(r => ({
    serviceName: r.serviceName,
    revenue: Number(r.revenue),
    count: Number(r.count)
  }));
}

export async function getDailyRevenue(db: PrismaClient | Prisma.TransactionClient, clinicId: string, days = 30) {
  const results = await db.$queryRaw<Array<{ date: Date; revenue: number; count: number }>>`
    SELECT 
      DATE(p."paymentDate") as date,
      SUM(p.amount) as revenue,
      COUNT(p.id) as count
    FROM "Payment" p
    WHERE p."clinicId" = ${clinicId}
      AND p.status = 'PAID'
      AND p."paymentDate" >= NOW() - (${days} || ' days')::INTERVAL
      AND p."isDeleted" = false
    GROUP BY DATE(p."paymentDate")
    ORDER BY date DESC
  `;

  return results.map(r => ({
    date: r.date,
    revenue: Number(r.revenue),
    count: Number(r.count)
  }));
}

// ==================== VALIDATION ====================

export async function checkPaymentExists(db: PrismaClient | Prisma.TransactionClient, id: string, clinicId: string) {
  return db.payment.findFirst({
    where: {
      id,
      clinicId,
      isDeleted: false
    },
    select: {
      id: true,
      clinicId: true,
      status: true
    }
  });
}

export async function checkBillExists(db: PrismaClient | Prisma.TransactionClient, id: string, clinicId: string) {
  return db.patientBill.findFirst({
    where: {
      id,
      payment: {
        clinicId,
        isDeleted: false
      }
    },
    select: {
      id: true,
      billId: true
    }
  });
}
