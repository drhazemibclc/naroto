import type { PrismaClient } from '../../generated/client';

/**
 * 🔷 DASHBOARD REPOSITORY
 * - ONLY raw Prisma queries
 * - NO business logic
 * - NO date calculations
 * - NO dedupeQuery
 */

export interface DashboardStatsParams {
  clinicId: string;
  currentTime: Date;
  monthEnd: Date;
  monthStart: Date;
  todayDayName: string;
  todayEnd: Date;
  todayStart: Date;
  tomorrowStart: Date;
}

export async function getDashboardStats(db: PrismaClient, params: DashboardStatsParams) {
  const { clinicId, todayStart, todayEnd, tomorrowStart, monthStart, monthEnd, currentTime, todayDayName } = params;

  return db.$transaction([
    // Total patients
    db.patient.count({
      where: { clinicId, isDeleted: false }
    }),

    // Total doctors
    db.doctor.count({
      where: { clinicId, isDeleted: false }
    }),

    // Total staff
    db.staff.count({
      where: { clinicId, deletedAt: null }
    }),

    // Today's appointments
    db.appointment.count({
      where: {
        clinicId,
        appointmentDate: { gte: todayStart, lt: todayEnd },
        isDeleted: false
      }
    }),

    // Upcoming appointments
    db.appointment.count({
      where: {
        clinicId,
        appointmentDate: { gte: tomorrowStart },
        status: { in: ['SCHEDULED', 'PENDING'] },
        isDeleted: false
      }
    }),

    // Overdue immunizations
    db.immunization.findMany({
      where: {
        patient: { clinicId },
        isDeleted: false,
        status: 'PENDING',
        date: { lt: currentTime }
      },
      orderBy: { date: 'asc' },
      take: 20,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true
          }
        }
      }
    }),

    // Recent appointments
    db.appointment.findMany({
      where: { clinicId, isDeleted: false },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            image: true,
            colorCode: true,
            gender: true,
            dateOfBirth: true
          }
        },
        doctor: {
          select: { id: true, name: true, specialty: true, img: true }
        },
        service: { select: { id: true, serviceName: true, price: true } }
      },
      orderBy: { appointmentDate: 'desc' },
      take: 10
    }),

    // Doctors working today
    db.doctor.findMany({
      where: {
        clinicId,
        isDeleted: false,
        workingDays: {
          some: { day: { equals: todayDayName, mode: 'insensitive' } }
        }
      },
      select: {
        id: true,
        name: true,
        specialty: true,
        img: true,
        colorCode: true
      },
      take: 5
    }),

    // Recent services
    db.service.findMany({
      where: { clinicId, isDeleted: false },
      orderBy: { serviceName: 'asc' },
      take: 10
    }),

    // Monthly revenue
    db.payment.aggregate({
      where: {
        clinicId,
        paymentDate: { gte: monthStart, lte: monthEnd },
        status: 'PAID',
        isDeleted: false
      },
      _sum: { amount: true }
    }),

    // Pending payments
    db.payment.count({
      where: { clinicId, status: 'UNPAID', isDeleted: false }
    })
  ]);
}

export interface DashboardRangeParams {
  clinicId: string;
  fromDate: Date;
  toDate: Date;
  todayDayName: string;
}

export async function getDashboardStatsWithRange(db: PrismaClient, params: DashboardRangeParams) {
  const { clinicId, fromDate, toDate, todayDayName } = params;

  return db.$transaction([
    // Total patients
    db.patient.count({
      where: { clinicId, isDeleted: false }
    }),

    // Total doctors
    db.doctor.count({
      where: { clinicId, isDeleted: false }
    }),

    // Total staff
    db.staff.count({
      where: { clinicId, deletedAt: null }
    }),

    // Appointments in range
    db.appointment.count({
      where: {
        clinicId,
        appointmentDate: { gte: fromDate, lte: toDate },
        isDeleted: false
      }
    }),

    // Upcoming appointments after range
    db.appointment.count({
      where: {
        clinicId,
        appointmentDate: { gt: toDate },
        status: { in: ['SCHEDULED', 'PENDING'] },
        isDeleted: false
      }
    }),

    // Recent appointments
    db.appointment.findMany({
      where: { clinicId, isDeleted: false },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true }
        },
        doctor: {
          select: { id: true, name: true, specialty: true }
        },
        service: {
          select: { id: true, serviceName: true, price: true }
        }
      },
      orderBy: { appointmentDate: 'desc' },
      take: 10
    }),

    // Doctors working today
    db.doctor.findMany({
      where: {
        clinicId,
        isDeleted: false,
        workingDays: {
          some: { day: { equals: todayDayName, mode: 'insensitive' } }
        }
      },
      take: 5
    }),

    // Recent services
    db.service.findMany({
      where: { clinicId, isDeleted: false },
      take: 10
    }),

    // Revenue in range
    db.payment.aggregate({
      where: {
        clinicId,
        paymentDate: { gte: fromDate, lte: toDate },
        status: 'PAID',
        isDeleted: false
      },
      _sum: { amount: true }
    }),

    // Pending payments
    db.payment.count({
      where: { clinicId, status: 'UNPAID', isDeleted: false }
    })
  ]);
}

export async function getClinicCounts(db: PrismaClient, clinicId: string) {
  return db.$transaction([
    db.patient.count({ where: { clinicId, isDeleted: false } }),
    db.doctor.count({ where: { clinicId, isDeleted: false } }),
    db.staff.count({ where: { clinicId, deletedAt: null } }),
    db.appointment.count({ where: { clinicId, isDeleted: false } })
  ]);
}

export async function findPatientById(db: PrismaClient, id: string, clinicId: string) {
  return db.patient.findUnique({
    where: {
      id,
      clinicId,
      isDeleted: false
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          image: true
        }
      }
    }
  });
}

export async function findPatientOutstandingBills(db: PrismaClient, patientId: string) {
  return db.patientBill.findFirst({
    where: {
      payment: {
        patientId,
        status: 'UNPAID',
        isDeleted: false
      }
    },
    include: {
      payment: true,
      service: true
    }
  });
}

// export async function archivePatient(db: PrismaClient, id: string, clinicId: string, data: { deletedAt: Date }) {
//   return db.patient.update({
//     where: { id, clinicId },
//     data
//   });
// }

export async function deletePatient(db: PrismaClient, id: string, clinicId: string) {
  return db.patient.delete({
    where: { id, clinicId }
  });
}

export async function findRecentActivity(db: PrismaClient, userId: string, clinicId: string, limit: number) {
  return db.auditLog.findMany({
    where: {
      userId,
      clinicId
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}
