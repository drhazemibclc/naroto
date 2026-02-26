import type { AppointmentStatus, Prisma, PrismaClient } from '@generated/client';
import { endOfDay, startOfDay, subDays, subMonths } from 'date-fns';

import type { AppointmentType } from '../types';
import { toNumber } from '../utils';

/**
 * 🔵 PURE QUERY LAYER
 * - NO business logic
 * - NO cache directives
 * - NO validation
 * - RAW Prisma only
 * - All functions accept PrismaClient as first parameter
 */

// ==================== SINGLE APPOINTMENT ====================
export async function findForMonth(db: PrismaClient, clinicId: string, startDate: Date, endDate: Date) {
  return db.appointment.findMany({
    where: {
      clinicId,
      appointmentDate: {
        gte: startDate,
        lte: endDate
      },
      isDeleted: false
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          image: true,
          colorCode: true,
          dateOfBirth: true
        }
      },
      doctor: {
        select: {
          id: true,
          name: true,
          specialty: true,
          img: true,
          colorCode: true
        }
      },
      service: {
        select: {
          id: true,
          serviceName: true,
          price: true
        }
      }
    },
    orderBy: { appointmentDate: 'asc' }
  });
}
export async function findTodaySchedule(
  db: PrismaClient,
  clinicId: string,
  dateRange: {
    todayStart: Date;
    todayEnd: Date;
  }
) {
  return db.appointment.findMany({
    where: {
      clinicId,
      appointmentDate: {
        gte: dateRange.todayStart,
        lt: dateRange.todayEnd
      },
      isDeleted: false
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true
        }
      },
      doctor: {
        select: {
          id: true,
          name: true,
          specialty: true
        }
      },
      service: {
        select: {
          id: true,
          serviceName: true,
          price: true
        }
      }
    },
    orderBy: { appointmentDate: 'asc' }
  });
}

export async function findAppointmentById(db: PrismaClient, id: string, clinicId: string) {
  return db.appointment.findUnique({
    where: {
      id,
      clinicId,
      isDeleted: false
    },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          specialty: true,
          availableFromTime: true,
          availableToTime: true,
          availabilityStatus: true,
          availableFromWeekDay: true,
          availableToWeekDay: true,
          colorCode: true,
          img: true
        }
      },
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gender: true,
          image: true,
          address: true,
          phone: true,
          colorCode: true
        }
      },
      service: {
        select: {
          id: true,
          serviceName: true,
          price: true
        }
      }
    }
  });
}

export async function findAppointmentByIdWithMedical(db: PrismaClient, id: string, clinicId: string) {
  return db.appointment.findUnique({
    where: {
      id,
      clinicId,
      isDeleted: false
    },
    include: {
      patient: true,
      doctor: true,
      service: true,
      bills: true,
      medical: {
        include: {
          encounter: true,
          labTest: true,
          vitalSigns: true,
          prescriptions: true
        }
      },
      reminders: true
    }
  });
}

// ==================== LIST APPOINTMENTS ====================

export interface FindAppointmentsByClinicParams {
  clinicId: string;
  doctorId?: string;
  fromDate?: Date;
  limit?: number;
  offset?: number;
  patientId?: string;
  status?: AppointmentStatus[];
  toDate?: Date;
}

export async function findAppointmentsByClinic(db: PrismaClient, params: FindAppointmentsByClinicParams) {
  const { clinicId, fromDate, toDate, status, doctorId, patientId, limit = 50, offset = 0 } = params;

  const where = {
    clinicId,
    isDeleted: false,
    ...(doctorId && { doctorId }),
    ...(patientId && { patientId }),
    ...(fromDate || toDate
      ? {
          appointmentDate: {
            ...(fromDate && { gte: fromDate }),
            ...(toDate && { lte: toDate })
          }
        }
      : {}),
    ...(status?.length
      ? {
          status: { in: status }
        }
      : {})
  };

  return db.appointment.findMany({
    where,
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          gender: true,
          image: true,
          dateOfBirth: true,
          colorCode: true
        }
      },
      doctor: {
        select: {
          id: true,
          name: true,
          specialty: true,
          colorCode: true,
          img: true
        }
      },
      service: {
        select: {
          id: true,
          serviceName: true,
          price: true
        }
      }
    },
    orderBy: { appointmentDate: 'desc' },
    take: limit,
    skip: offset
  });
}

export interface FindAppointmentsByPatientParams {
  clinicId: string;
  fromDate?: Date;
  includePast?: boolean;
  limit?: number;
  offset?: number;
  patientId: string;
  status?: AppointmentStatus[];
  toDate?: Date;
}

// ==================== APPOINTMENTS ====================

export async function getRecentAppointments(db: PrismaClient, clinicId: string) {
  const today = new Date();
  return db.appointment.findMany({
    where: {
      clinicId,
      appointmentDate: { gte: startOfDay(today), lte: endOfDay(today) },
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
    },
    orderBy: { appointmentDate: 'asc' }
  });
}
export async function countAppointmentsInRange(db: PrismaClient, clinicId: string, startDate: Date, endDate: Date) {
  return db.appointment.count({
    where: {
      clinicId,
      isDeleted: false,
      appointmentDate: {
        gte: startDate,
        lte: endDate
      }
    }
  });
}

export async function countAppointmentsByStatus(db: PrismaClient, clinicId: string, status: AppointmentStatus[]) {
  return db.appointment.count({
    where: {
      clinicId,
      status: { in: status },
      isDeleted: false
    }
  });
}

export async function getTodaySchedule(db: PrismaClient, clinicId: string) {
  const today = new Date();
  const currentDay = today.toLocaleString('en-US', { weekday: 'long' });

  return db.doctor.findMany({
    where: {
      clinicId,
      isDeleted: false
    },
    include: {
      appointments: {
        where: {
          appointmentDate: {
            gte: startOfDay(today),
            lte: endOfDay(currentDay === 'Sunday' ? subDays(today, 1) : today)
          },
          isDeleted: false
        },
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
              image: true,
              colorCode: true
            }
          }
        }
      },
      workingDays: {
        where: { clinicId }
      }
    }
  });
}

export async function getAppointmentStatsPerDay(
  db: PrismaClient,
  clinicId: string,
  period: 'day' | 'week' | 'month' | 'year' = 'month'
) {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'day':
      startDate = startOfDay(now);
      break;
    case 'week':
      startDate = subDays(now, 7);
      break;
    case 'month':
      startDate = subMonths(now, 1);
      break;
    case 'year':
      startDate = subMonths(now, 12);
      break;
    default:
      startDate = subMonths(now, 1);
      break;
  }

  return db.appointment.groupBy({
    by: ['status'],
    where: {
      clinicId,
      appointmentDate: { gte: startDate },
      isDeleted: false
    },
    _count: { _all: true }
  });
}

export async function findAppointmentsByPatient(db: PrismaClient, params: FindAppointmentsByPatientParams) {
  const { patientId, clinicId, limit = 20, offset = 0, includePast = false, status, fromDate, toDate } = params;

  const now = new Date();
  const where = {
    patientId,
    clinicId,
    isDeleted: false,
    ...(status?.length
      ? {
          status: { in: status }
        }
      : {}),
    ...(fromDate || toDate
      ? {
          appointmentDate: {
            ...(fromDate && { gte: fromDate }),
            ...(toDate && { lte: toDate })
          }
        }
      : includePast
        ? {}
        : {
            appointmentDate: { gte: now }
          })
  };

  return db.appointment.findMany({
    where,
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          specialty: true,
          img: true,
          colorCode: true
        }
      },
      service: {
        select: {
          id: true,
          serviceName: true,
          price: true
        }
      }
    },
    orderBy: { appointmentDate: includePast ? 'desc' : 'asc' },
    take: limit,
    skip: offset
  });
}

export interface FindAppointmentsByDoctorParams {
  clinicId: string;
  doctorId: string;
  fromDate?: Date;
  limit?: number;
  offset?: number;
  patientId?: string;
  status?: AppointmentStatus[];
  toDate?: Date;
}
export async function findAppointmentsByDoctor(db: PrismaClient, params: FindAppointmentsByDoctorParams) {
  const { doctorId, clinicId, fromDate, toDate, status, patientId, limit = 50, offset = 0 } = params;

  // Use Prisma.AppointmentWhereInput for type safety
  const where: Prisma.AppointmentWhereInput = {
    doctorId,
    clinicId,
    isDeleted: false,
    ...(patientId && { patientId }),
    ...(status?.length && { status: { in: status } }),
    ...((fromDate || toDate) && {
      appointmentDate: {
        ...(fromDate && { gte: fromDate }),
        ...(toDate && { lte: toDate })
      }
    })
  };

  return db.appointment.findMany({
    where,
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          dateOfBirth: true,
          gender: true,
          image: true,
          colorCode: true
        }
      }
    },
    orderBy: { appointmentDate: 'asc' },
    take: limit,
    skip: offset
  });
}

// ==================== CREATE/UPDATE APPOINTMENTS ====================
export async function createAppointment(db: PrismaClient, data: Prisma.AppointmentUncheckedCreateInput) {
  return db.appointment.create({
    data: {
      ...data,
      type: (data.type as AppointmentType) || 'CHECKUP',
      status: (data.status as AppointmentStatus) || 'SCHEDULED'
    },
    select: {
      id: true,
      appointmentDate: true,
      time: true,
      patient: {
        select: {
          firstName: true,
          lastName: true,
          phone: true
        }
      },
      doctor: {
        select: {
          name: true
        }
      }
    }
  });
}

export async function updateAppointment(
  db: PrismaClient,
  id: string,
  clinicId: string,
  data: Prisma.AppointmentUncheckedUpdateInput
) {
  return db.appointment.update({
    where: {
      id,
      clinicId,
      isDeleted: false // Safety check: don't update deleted records
    },
    data: {
      ...data
      // We omit updatedAt here to let the Service or Prisma handle it
    },
    include: {
      patient: {
        select: {
          firstName: true,
          lastName: true,
          phone: true
        }
      },
      doctor: {
        select: {
          name: true
        }
      }
    }
  });
}

export async function updateAppointmentStatus(
  db: PrismaClient,
  id: string,
  clinicId: string,
  status: AppointmentStatus,
  reason?: string
) {
  return db.appointment.update({
    where: {
      id,
      clinicId
    },
    data: {
      status,
      ...(reason && { reason }),
      updatedAt: new Date()
    },
    select: {
      id: true,
      status: true,
      reason: true,
      appointmentDate: true,
      patient: {
        select: {
          firstName: true,
          lastName: true,
          phone: true
        }
      },
      doctor: {
        select: {
          name: true
        }
      }
    }
  });
}

// ==================== TODAY'S APPOINTMENTS ====================

export async function findTodayAppointments(
  db: PrismaClient,
  clinicId: string,
  options?: {
    doctorId?: string;
    status?: AppointmentStatus[];
  }
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const where = {
    clinicId,
    appointmentDate: {
      gte: today,
      lt: tomorrow
    },
    isDeleted: false,
    ...(options?.doctorId && { doctorId: options.doctorId }),
    ...(options?.status?.length && {
      status: { in: options.status }
    })
  };

  return db.appointment.findMany({
    where,
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          image: true,
          colorCode: true,
          dateOfBirth: true
        }
      },
      doctor: {
        select: {
          id: true,
          name: true,
          specialty: true,
          img: true,
          colorCode: true
        }
      },
      service: {
        select: {
          id: true,
          serviceName: true,
          price: true
        }
      }
    },
    orderBy: { time: 'asc' }
  });
}

// ==================== UPCOMING APPOINTMENTS ====================

export async function findUpcomingAppointments(
  db: PrismaClient,
  clinicId: string,
  options?: {
    doctorId?: string;
    patientId?: string;
    limit?: number;
    days?: number;
  }
) {
  const now = new Date();
  const daysAhead = options?.days || 7;
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + daysAhead);

  const where = {
    clinicId,
    appointmentDate: {
      gte: now,
      lte: endDate
    },
    status: {
      in: ['SCHEDULED', 'PENDING', 'CONFIRMED'] as AppointmentStatus[]
    },
    isDeleted: false,
    ...(options?.doctorId && { doctorId: options.doctorId }),
    ...(options?.patientId && { patientId: options.patientId })
  };

  return db.appointment.findMany({
    where,
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          image: true,
          colorCode: true,
          dateOfBirth: true
        }
      },
      doctor: {
        select: {
          id: true,
          name: true,
          specialty: true,
          img: true,
          colorCode: true
        }
      },
      service: {
        select: {
          id: true,
          serviceName: true,
          price: true
        }
      }
    },
    orderBy: { appointmentDate: 'asc' },
    take: options?.limit || 20
  });
}

// ==================== CALENDAR MONTH VIEW ====================

export async function findAppointmentsForMonth(
  db: PrismaClient,
  clinicId: string,
  startDate: Date,
  endDate: Date,
  options?: {
    doctorId?: string;
    patientId?: string;
  }
) {
  return db.appointment.findMany({
    where: {
      clinicId,
      appointmentDate: {
        gte: startDate,
        lte: endDate
      },
      isDeleted: false,
      ...(options?.doctorId && { doctorId: options.doctorId }),
      ...(options?.patientId && { patientId: options.patientId })
    },
    select: {
      id: true,
      patientId: true,
      doctorId: true,
      serviceId: true,
      type: true,
      appointmentDate: true,
      time: true,
      status: true,
      appointmentPrice: true,
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          colorCode: true
        }
      },
      doctor: {
        select: {
          id: true,
          name: true,
          colorCode: true,
          img: true
        }
      }
    },
    orderBy: [{ appointmentDate: 'asc' }, { time: 'asc' }]
  });
}

export async function deletePermanently(db: PrismaClient, id: string) {
  return db.appointment.delete({
    where: {
      id
    }
  });
}
export async function findBookedTimes(db: PrismaClient | Prisma.TransactionClient, doctorId: string, date: Date) {
  // Normalize date to start and end of day to ensure query coverage
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return db.appointment.findMany({
    where: {
      doctorId,
      appointmentDate: {
        gte: startOfDay,
        lte: endOfDay
      },
      // Only count appointments that aren't cancelled or deleted
      status: {
        notIn: ['CANCELLED']
      },
      isDeleted: false
    },
    select: {
      time: true // Only select what we need to minimize payload
    }
  });
}
// ==================== STATISTICS ====================

export interface AppointmentStats {
  averagePerDay?: number;
  byStatus: Array<{
    status: AppointmentStatus;
    count: number;
  }>;
  revenue?: number;
  today: number;
  total: number;
  upcoming: number;
}

export async function getAppointmentStats(
  db: PrismaClient,
  clinicId: string,
  options?: {
    fromDate?: Date;
    toDate?: Date;
  }
): Promise<AppointmentStats> {
  const where = {
    clinicId,
    isDeleted: false,
    ...(options?.fromDate || options?.toDate
      ? {
          appointmentDate: {
            ...(options?.fromDate && { gte: options.fromDate }),
            ...(options?.toDate && { lte: options.toDate })
          }
        }
      : {})
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [total, byStatus, upcoming, todayCount, revenue] = await Promise.all([
    db.appointment.count({ where }),

    db.appointment.groupBy({
      by: ['status'],
      where,
      _count: {
        status: true
      }
    }),

    db.appointment.count({
      where: {
        ...where,
        appointmentDate: { gte: new Date() },
        status: { in: ['SCHEDULED', 'PENDING', 'COMPLETED'] }
      }
    }),

    db.appointment.count({
      where: {
        ...where,
        appointmentDate: {
          gte: today,
          lt: tomorrow
        }
      }
    }),

    db.appointment.aggregate({
      where: {
        ...where,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] }
      },
      _sum: {
        appointmentPrice: true
      }
    })
  ]);

  const daysDiff =
    options?.fromDate && options?.toDate
      ? Math.ceil((options.toDate.getTime() - options.fromDate.getTime()) / (1000 * 60 * 60 * 24))
      : 30;

  return {
    total,
    byStatus: byStatus.map(item => ({
      status: item.status as AppointmentStatus,
      count: item._count.status
    })),
    upcoming,
    today: todayCount,
    revenue: toNumber(revenue._sum.appointmentPrice) || 0,
    averagePerDay: total / daysDiff
  };
}

// ==================== AVAILABLE TIMES (PURE QUERY) ====================

export async function findBookedAppointmentTimes(db: PrismaClient, doctorId: string, clinicId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return db.appointment.findMany({
    where: {
      doctorId,
      clinicId,
      appointmentDate: {
        gte: startOfDay,
        lte: endOfDay
      },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      isDeleted: false
    },
    select: {
      time: true,
      appointmentDate: true,
      patient: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: { time: 'asc' }
  });
}

export async function findDoctorSchedule(db: PrismaClient, doctorId: string, clinicId: string) {
  return db.doctor.findUnique({
    where: {
      id: doctorId,
      clinicId,
      isDeleted: false
    },
    select: {
      availableFromTime: true,
      availableToTime: true,
      availableFromWeekDay: true,
      availableToWeekDay: true,
      workingDays: {
        select: {
          day: true,
          startTime: true,
          endTime: true
        }
      }
    }
  });
}

// ==================== CONFLICT CHECK ====================

export async function findConflictingAppointments(
  db: PrismaClient,
  doctorId: string,
  clinicId: string,
  appointmentDate: Date,
  time: string,
  excludeId?: string
) {
  // Parse the time string (assuming format like "09:00")
  const [hours, minutes] = time.split(':').map(Number);

  const appointmentDateTime = new Date(appointmentDate);
  appointmentDateTime.setHours(hours ?? 0, minutes, 0, 0);

  const startBuffer = new Date(appointmentDateTime);
  startBuffer.setMinutes(startBuffer.getMinutes() - 30);

  const endBuffer = new Date(appointmentDateTime);
  endBuffer.setMinutes(endBuffer.getMinutes() + 30);

  return db.appointment.findMany({
    where: {
      doctorId,
      clinicId,
      appointmentDate: {
        gte: startBuffer,
        lte: endBuffer
      },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      isDeleted: false,
      NOT: excludeId ? { id: excludeId } : undefined
    },
    select: {
      id: true,
      appointmentDate: true,
      time: true,
      patient: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  });
}

// ==================== SOFT DELETE ====================

export async function softDeleteAppointment(db: PrismaClient, id: string, clinicId: string) {
  return db.appointment.update({
    where: {
      id,
      clinicId
    },
    data: {
      isDeleted: true,
      deletedAt: new Date()
    }
  });
}

// ==================== BATCH OPERATIONS ====================

export async function findAppointmentsByIds(db: PrismaClient, ids: string[], clinicId: string) {
  return db.appointment.findMany({
    where: {
      id: { in: ids },
      clinicId,
      isDeleted: false
    },
    include: {
      patient: {
        select: {
          firstName: true,
          lastName: true,
          phone: true
        }
      },
      doctor: {
        select: {
          name: true
        }
      }
    }
  });
}

export async function batchUpdateAppointmentStatus(
  db: PrismaClient,
  ids: string[],
  clinicId: string,
  status: AppointmentStatus,
  reason?: string
) {
  return db.appointment.updateMany({
    where: {
      id: { in: ids },
      clinicId,
      isDeleted: false
    },
    data: {
      status,
      ...(reason && { reason }),
      updatedAt: new Date()
    }
  });
}

// ==================== VALIDATION ====================

export async function checkAppointmentOverlap(
  db: PrismaClient,
  doctorId: string,
  clinicId: string,
  appointmentDate: Date,
  excludeId?: string
): Promise<boolean> {
  const startOfDay = new Date(appointmentDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(appointmentDate);
  endOfDay.setHours(23, 59, 59, 999);

  const count = await db.appointment.count({
    where: {
      doctorId,
      clinicId,
      appointmentDate: {
        gte: startOfDay,
        lte: endOfDay
      },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      isDeleted: false,
      NOT: excludeId ? { id: excludeId } : undefined
    }
  });

  return count > 0;
}

export async function validateDoctorAvailability(
  db: PrismaClient,
  doctorId: string,
  clinicId: string,
  appointmentDate: Date
): Promise<boolean> {
  const dayOfWeek = appointmentDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const time = appointmentDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const doctor = await db.doctor.findUnique({
    where: { id: doctorId, clinicId },
    select: {
      workingDays: {
        where: {
          day: dayOfWeek
        },
        select: {
          startTime: true,
          endTime: true
        }
      }
    }
  });

  if (!doctor || doctor.workingDays.length === 0) {
    return false;
  }

  const workingDay = doctor.workingDays[0];
  return !!workingDay && time >= workingDay.startTime && time <= workingDay.endTime;
}

/**
 * 📦 Grouped Export for convenience
 */
export const appointmentQueries = {
  // Single Appointment
  findById: findAppointmentById,
  findByIdWithMedical: findAppointmentByIdWithMedical,
  softDelete: softDeleteAppointment,

  // List Appointments
  findByClinic: findAppointmentsByClinic,
  findByPatient: findAppointmentsByPatient,
  findByDoctor: findAppointmentsByDoctor,

  // Create/Update
  create: createAppointment,
  update: updateAppointment,
  updateStatus: updateAppointmentStatus,

  // Today's & Upcoming
  findToday: findTodayAppointments,
  findUpcoming: findUpcomingAppointments,

  // Calendar Month View
  findForMonth: findAppointmentsForMonth,

  // Statistics
  getStats: getAppointmentStats,

  // Available Times
  findBookedTimes: findBookedAppointmentTimes,
  findDoctorSchedule,

  // Conflict Check
  findConflicting: findConflictingAppointments,

  // Batch Operations
  findByIds: findAppointmentsByIds,
  batchUpdateStatus: batchUpdateAppointmentStatus,

  // Validation
  checkOverlap: checkAppointmentOverlap,
  validateDoctorAvailability
} as const;
