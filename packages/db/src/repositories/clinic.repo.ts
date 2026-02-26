import type { PrismaClient } from '@generated/client';
import { addDays, endOfDay, endOfMonth, startOfDay, startOfMonth, subDays, subMonths } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

import type { UserRole } from '../types';

const TIMEZONE = 'Africa/Cairo';

/**
 * 🔵 PURE QUERY LAYER
 * - NO business logic
 * - NO cache directives
 * - NO auth/session
 * - RAW Prisma only
 * - All functions accept PrismaClient as first parameter
 */

// ==================== READ OPERATIONS ====================

export async function findClinicById(db: PrismaClient, id: string) {
  return db.clinic.findUnique({
    where: { id, isDeleted: false }
  });
}

export async function findClinicWithUserAccess(db: PrismaClient, clinicId: string, userId: string) {
  return db.clinicMember.findUnique({
    where: {
      userId_clinicId: {
        userId,
        clinicId
      }
    },
    include: {
      clinic: {
        select: {
          id: true,
          name: true,
          logo: true,
          address: true,
          phone: true,
          email: true
        }
      }
    }
  });
}

export async function findClinicHoursById(db: PrismaClient, clinicId: string) {
  return db.workingDays.findMany({
    where: { clinicId },
    orderBy: { day: 'asc' }
  });
}

export async function getFeatures(db: PrismaClient) {
  return db.feature.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      icon: true,
      color: true
    }
  });
}

export async function getClinicStats(db: PrismaClient) {
  return db.$transaction([
    db.doctor.count({ where: { isActive: true, isDeleted: false } }),
    db.patient.count({ where: { isActive: true, isDeleted: false } }),
    db.appointment.count({
      where: {
        appointmentDate: { gte: new Date(new Date().getFullYear(), 0, 1) },
        isDeleted: false
      }
    }),
    db.rating.aggregate({
      _avg: { rating: true }
    })
  ]);
}

export async function countUserClinics(db: PrismaClient, userId: string) {
  return db.clinicMember.count({
    where: { userId }
  });
}

// ==================== CLINIC MEMBERS ====================

export async function findClinicMembers(
  db: PrismaClient,
  clinicId: string,
  options?: {
    role?: UserRole;
    skip?: number;
    take?: number;
  }
) {
  const { role, skip = 0, take = 50 } = options || {};

  return db.clinicMember.findMany({
    where: {
      clinicId,
      ...(role && { role })
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true
        }
      }
    },
    skip,
    take,
    orderBy: { createdAt: 'desc' }
  });
}

export async function countClinicMembersByRole(
  db: PrismaClient,
  clinicId: string
): Promise<Array<{ role: string; count: number }>> {
  return db.$queryRaw`
    SELECT role, COUNT(*) as count
    FROM clinic_members
    WHERE "clinicId" = ${clinicId}
    GROUP BY role
  `;
}

// ==================== WRITE OPERATIONS ====================

export async function createClinic(
  db: PrismaClient,
  data: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string;
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    taxId?: string;
    licenseNumber?: string;
  }
) {
  return db.clinic.create({
    data: {
      ...data,
      isDeleted: false
    }
  });
}

export async function updateClinic(
  db: PrismaClient,
  id: string,
  data: Partial<{
    name: string;
    address: string;
    phone: string;
    updatedAt: Date;
    email: string;
    logo?: string;
    isActive: boolean;
    taxId: string;
    licenseNumber: string;
  }>
) {
  return db.clinic.update({
    where: { id },
    data
  });
}

export async function createClinicMember(
  db: PrismaClient,
  data: {
    userId: string;
    clinicId: string;
    role?: UserRole;
  }
) {
  return db.clinicMember.create({
    data: {
      userId: data.userId,
      clinicId: data.clinicId,
      role: data.role || 'STAFF',
      createdAt: new Date()
    }
  });
}

export async function removeClinicMember(db: PrismaClient, userId: string, clinicId: string) {
  return db.clinicMember.delete({
    where: {
      userId_clinicId: {
        userId,
        clinicId
      }
    }
  });
}

export async function createRating(
  db: PrismaClient,
  data: {
    patientId: string;
    staffId: string;
    rating: number;
    clinicId?: string;
    createdAt: Date;
    comment?: string;
  }
) {
  return db.rating.create({
    data
  });
}

// ==================== DASHBOARD STATS ====================

export interface AdminDashboardStatsParams {
  clinicId: string;
  from: Date;
  to: Date;
}

export async function getAdminDashboardStats(db: PrismaClient, params: AdminDashboardStatsParams) {
  const { clinicId, from, to } = params;
  const now = new Date();
  const chartStartDate = startOfDay(subDays(now, 10));
  const chartEndDate = endOfDay(addDays(now, 10));

  const todayStart = toZonedTime(startOfDay(now), TIMEZONE);
  const todayEnd = toZonedTime(endOfDay(now), TIMEZONE);

  return db.$transaction([
    // 1. Total revenue for period
    db.appointment.aggregate({
      _sum: { appointmentPrice: true },
      where: {
        clinicId,
        appointmentDate: { gte: from, lte: to },
        isDeleted: false
      }
    }),
    // 2. Total appointments for period
    db.appointment.count({
      where: {
        clinicId,
        appointmentDate: { gte: from, lte: to },
        isDeleted: false
      }
    }),
    // 3. Total patients
    db.patient.count({
      where: { clinicId, isDeleted: false }
    }),
    // 4. Total doctors
    db.doctor.count({
      where: { clinicId, isDeleted: false }
    }),
    // 5. Top doctors by appointments
    db.doctor.findMany({
      where: {
        clinicId,
        isDeleted: false
      },
      select: {
        id: true,
        name: true,
        img: true,
        specialty: true,
        _count: {
          select: {
            appointments: {
              where: {
                appointmentDate: { gte: from, lte: to },
                isDeleted: false
              }
            }
          }
        },
        ratings: {
          select: {
            rating: true
          }
        }
      },
      orderBy: {
        appointments: {
          _count: 'desc'
        }
      },
      take: 10
    }),
    // 6. Today's appointments
    db.appointment.findMany({
      where: {
        clinicId,
        appointmentDate: { gte: todayStart, lte: todayEnd },
        isDeleted: false
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            image: true,
            colorCode: true
          }
        },
        doctor: {
          select: {
            id: true,
            name: true,
            img: true,
            colorCode: true,
            specialty: true
          }
        }
      }
    }),
    // 7. Chart data (last 10 days to next 10 days)
    db.appointment.groupBy({
      by: ['appointmentDate'],
      where: {
        clinicId,
        appointmentDate: { gte: chartStartDate, lte: chartEndDate },
        isDeleted: false
      },
      _count: { _all: true },
      _sum: { appointmentPrice: true },
      orderBy: { appointmentDate: 'asc' }
    }),
    // 8. Available services count
    db.service.count({
      where: {
        clinicId,
        isAvailable: true,
        isDeleted: false
      }
    })
  ]);
}

export async function getSpecialtyStats(db: PrismaClient, clinicId: string, from: Date, to: Date) {
  const groupedByDoctor = await db.appointment.groupBy({
    by: ['doctorId'],
    where: {
      clinicId,
      appointmentDate: { gte: from, lte: to },
      isDeleted: false
    },
    _count: { _all: true },
    orderBy: { doctorId: 'asc' },
    take: 50
  });

  const doctorIds = groupedByDoctor.map(g => g.doctorId).filter((id): id is string => id !== null);

  const doctors = doctorIds.length
    ? await db.doctor.findMany({
        where: { id: { in: doctorIds }, isDeleted: false },
        select: { id: true, specialty: true }
      })
    : [];

  return { groupedByDoctor, doctors };
}

export async function getGeneralStats(db: PrismaClient) {
  return db.$transaction([
    db.patient.count({ where: { isDeleted: false } }),
    db.doctor.count({ where: { isDeleted: false } }),
    db.appointment.count({ where: { isDeleted: false } }),
    db.appointment.count({
      where: {
        status: 'COMPLETED',
        isDeleted: false
      }
    })
  ]);
}

// ==================== MEDICAL RECORDS ====================

export async function getMedicalRecordsSummary(db: PrismaClient, clinicId: string) {
  const now = new Date();
  const startOfCurrentMonth = startOfMonth(now);
  const endOfCurrentMonth = endOfMonth(now);
  const startOfPreviousMonth = startOfMonth(subMonths(now, 1));
  const endOfPreviousMonth = endOfMonth(subMonths(now, 1));

  return db.$transaction([
    // Total medical records
    db.medicalRecords.count({
      where: { clinicId, isDeleted: false }
    }),
    // Current month records
    db.medicalRecords.count({
      where: {
        clinicId,
        createdAt: { gte: startOfCurrentMonth, lte: endOfCurrentMonth },
        isDeleted: false
      }
    }),
    // Previous month records
    db.medicalRecords.count({
      where: {
        clinicId,
        createdAt: { gte: startOfPreviousMonth, lte: endOfPreviousMonth },
        isDeleted: false
      }
    }),
    // Recent records
    db.medicalRecords.findMany({
      where: { clinicId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        patientId: true,
        appointmentId: true,
        clinicId: true,
        treatmentPlan: true,
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true
          }
        }
      }
    })
  ]);
}

// ==================== IMMUNIZATIONS ====================

export async function getUpcomingImmunizations(db: PrismaClient, clinicId: string, daysAhead = 30) {
  const today = new Date();
  const endDate = addDays(today, daysAhead);

  return db.immunization.findMany({
    where: {
      date: { gte: today, lte: endDate },
      isDeleted: false,
      patient: {
        clinicId,
        isDeleted: false
      }
    },
    include: {
      patient: {
        select: {
          firstName: true,
          lastName: true,
          id: true,
          dateOfBirth: true,
          emergencyContactNumber: true,
          emergencyContactName: true,
          address: true,
          gender: true,
          image: true,
          colorCode: true
        }
      }
    },
    orderBy: { date: 'asc' }
  });
}

export async function getImmunizationCoverage(
  db: PrismaClient,
  clinicId: string
): Promise<Array<{ vaccine: string; administered: number; due: number }>> {
  return db.$queryRaw`
    SELECT 
      v.name as vaccine,
      COUNT(CASE WHEN i."administeredDate" IS NOT NULL THEN 1 END) as administered,
      COUNT(CASE WHEN i."dueDate" < NOW() AND i."administeredDate" IS NULL THEN 1 END) as due
    FROM vaccines v
    LEFT JOIN immunizations i ON i."vaccineId" = v.id
    LEFT JOIN patients p ON p.id = i."patientId" AND p."clinicId" = ${clinicId}
    WHERE v."isActive" = true
    GROUP BY v.id, v.name
  `;
}

// ==================== PERFORMANCE ====================

export interface MonthlyPerformance {
  month: number;
  revenue: number;
  uniquePatients: number;
  visits: number;
}

export async function getMonthlyPerformance(db: PrismaClient, clinicId: string): Promise<MonthlyPerformance[]> {
  const currentYear = new Date().getFullYear();

  const data = await db.$queryRaw<
    Array<{
      month: number;
      visits: bigint;
      revenue: bigint;
      uniquePatients: bigint;
    }>
  >`
    SELECT
      EXTRACT(MONTH FROM a."appointmentDate") AS month,
      COUNT(*) AS visits,
      COALESCE(SUM(a."appointmentPrice"), 0) AS revenue,
      COUNT(DISTINCT a."patientId") AS "uniquePatients"
    FROM "Appointment" a
    WHERE 
      EXTRACT(YEAR FROM a."appointmentDate") = ${currentYear}
      AND a."clinicId" = ${clinicId}
      AND a."isDeleted" = false
    GROUP BY month
    ORDER BY month
  `;

  return data.map(item => ({
    month: Number(item.month),
    visits: Number(item.visits),
    revenue: Number(item.revenue),
    uniquePatients: Number(item.uniquePatients)
  }));
}

export async function getDoctorPerformance(db: PrismaClient, clinicId: string, from: Date, to: Date) {
  return db.doctor.findMany({
    where: {
      clinicId,
      isDeleted: false
    },
    select: {
      id: true,
      name: true,
      specialty: true,
      img: true,
      _count: {
        select: {
          appointments: {
            where: {
              appointmentDate: { gte: from, lte: to },
              isDeleted: false
            }
          }
        }
      },
      ratings: {
        select: {
          rating: true
        }
      }
    },
    orderBy: {
      appointments: {
        _count: 'desc'
      }
    }
  });
}

// ==================== FINANCIAL ====================

export async function getRevenueBreakdown(db: PrismaClient, clinicId: string, from: Date, to: Date) {
  return db.appointment.groupBy({
    by: ['serviceId'],
    where: {
      clinicId,
      appointmentDate: { gte: from, lte: to },
      isDeleted: false
    },
    _count: { _all: true },
    _sum: { appointmentPrice: true },
    having: {
      appointmentPrice: {
        _sum: {
          gt: 0
        }
      }
    }
  });
}

export async function getPaymentStatusStats(db: PrismaClient, clinicId: string, from: Date, to: Date) {
  return db.appointment.groupBy({
    by: ['status'],
    where: {
      clinicId,
      appointmentDate: { gte: from, lte: to },
      isDeleted: false
    },
    _count: { _all: true },
    _sum: { appointmentPrice: true }
  });
}

// NO business logic, NO cache directives, NO auth checks

/**
 * 📦 Grouped Export for convenience
 * This allows you to use: import { clinicQueries } from '@repo/db/clinic'
 */
export const clinicQueries = {
  // Read Operations
  findById: findClinicById,
  findClinicWithUserAccess,
  findClinicHoursById,
  getFeatures,
  getClinicStats,
  countUserClinics,

  // Clinic Members
  findMembers: findClinicMembers,
  countMembersByRole: countClinicMembersByRole,

  // Write Operations
  create: createClinic,
  update: updateClinic,
  createMember: createClinicMember,
  removeMember: removeClinicMember,
  createRating,

  // Dashboard
  getAdminDashboardStats,
  getSpecialtyStats,
  getGeneralStats,

  // Medical Records
  getMedicalRecordsSummary,

  // Immunizations
  getUpcomingImmunizations,
  getImmunizationCoverage,

  // Performance
  getMonthlyPerformance,
  getDoctorPerformance,

  // Financial
  getRevenueBreakdown,
  getPaymentStatusStats
} as const;
