// packages/db/src/Appointments.query.ts

import { endOfDay, startOfDay, subDays, subMonths } from 'date-fns';

import type { AppointmentStatus, AppointmentType, Prisma, PrismaClient } from '../../generated/client';
import { toNumber } from '../utils';

/**
 * 🔵 PURE QUERY LAYER
 * - NO business logic
 * - NO cache directives
 * - NO validation
 * - RAW Prisma only
 * - All functions accept PrismaClient as first parameter
 */


export async function findRecentAppointments(db: PrismaClient, clinicId: string, limit: number, offset: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return db.appointment.findMany({
    where: { clinicId, isDeleted: false, appointmentDate: { gte: today } },
    orderBy: { appointmentDate: 'desc' },
    take: limit,
    skip: offset
  });
}
// ==================== SINGLE APPOINTMENT ====================
export async function findTodaySchedule(db: PrismaClient, clinicId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return db.appointment.findMany({
    where: {
      clinicId,
      appointmentDate: {
        gte: startOfDay,
        lte: endOfDay
      },
      isDeleted: false
    },
    include: {
      patient: true,
      doctor: true
    },
    orderBy: { appointmentDate: 'asc' }
  });
}

/**
 * Finds all appointments for a month range
 */
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
      patient: { select: { firstName: true, lastName: true } }
    }
  });
}

export async function searchAppointmentsByPatientName(
  db: PrismaClient,
  clinicId: string,
  patientName: string,
  limit = 50
) {
  return db.appointment.findMany({
    where: {
      clinicId,
      patient: {
        OR: [
          { firstName: { contains: patientName, mode: 'insensitive' } },
          { lastName: { contains: patientName, mode: 'insensitive' } }
        ]
      },
      isDeleted: false
    },
    take: limit,
    include: { patient: true, doctor: true }
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

export interface FindAppointmentsParams {
  clinicId: string;
  doctorId?: string;
  fromDate?: Date;
  limit?: number;
  offset?: number;
  patientId?: string;
  search?: string;
  status?: AppointmentStatus[];
  toDate?: Date;
  type?: AppointmentType[];
}

export async function findAppointments(db: PrismaClient, params: FindAppointmentsParams) {
  const { clinicId, doctorId, patientId, fromDate, toDate, status, type, search, limit = 50, offset = 0 } = params;

  const where: Prisma.AppointmentWhereInput = {
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
      : {}),
    ...(type?.length
      ? {
          type: { in: type }
        }
      : {}),
    ...(search
      ? {
          patient: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } }
            ]
          }
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

export async function findAppointmentsByPatient(
  db: PrismaClient,
  params: Omit<FindAppointmentsParams, 'doctorId'> & { includePast?: boolean }
) {
  const { patientId, clinicId, limit = 20, offset = 0, includePast = false, status, fromDate, toDate } = params;

  const now = new Date();

  const where: Prisma.AppointmentWhereInput = {
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

export async function findAppointmentsByDoctor(db: PrismaClient, params: FindAppointmentsParams) {
  const { doctorId, clinicId, fromDate, toDate, status, patientId, limit = 50, offset = 0 } = params;

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

  const where: Prisma.AppointmentWhereInput = {
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
    orderBy: [{ appointmentDate: 'asc' }, { time: 'asc' }]
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

  const where: Prisma.AppointmentWhereInput = {
    clinicId,
    appointmentDate: {
      gte: now,
      lte: endDate
    },
    status: {
      in: ['SCHEDULED', 'CONFIRMED'] as AppointmentStatus[]
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

// ==================== CREATE/UPDATE ====================

export async function createAppointment(db: PrismaClient, data: Prisma.AppointmentUncheckedCreateInput) {
  return db.appointment.create({
    data,
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
      isDeleted: false
    },
    data,
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
      ...(reason && { cancellationReason: reason }),
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

// ==================== SOFT DELETE ====================

export async function softDeleteAppointment(db: PrismaClient, id: string, clinicId: string, _deletedById: string) {
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

export async function deletePermanently(db: PrismaClient, id: string) {
  return db.appointment.delete({
    where: {
      id
    }
  });
}

export async function deleteAllForClinic(db: PrismaClient, clinicId: string) {
  const result = await db.appointment.deleteMany({
    where: {
      clinicId
    }
  });
  return result.count;
}

// ==================== CONFLICT CHECK ====================

export async function findConflictingAppointments(
  db: PrismaClient,
  doctorId: string,
  clinicId: string,
  appointmentDate: Date,
  time: string,
  duration: number,
  excludeId?: string
) {
  // Parse the time string (format: "HH:mm")
  const [hours, minutes] = time.split(':').map(Number);

  const appointmentDateTime = new Date(appointmentDate);
  appointmentDateTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);

  const startTime = new Date(appointmentDateTime);
  startTime.setMinutes(startTime.getMinutes() - 30); // 30 min buffer

  const endTime = new Date(appointmentDateTime);
  endTime.setMinutes(endTime.getMinutes() + duration + 30); // appointment + buffer

  return db.appointment.findMany({
    where: {
      doctorId,
      clinicId,
      appointmentDate: {
        gte: startTime,
        lte: endTime
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

export async function checkAppointmentOverlap(
  db: PrismaClient,
  doctorId: string,
  clinicId: string,
  appointmentDate: Date,
  time: string,
  duration: number,
  excludeId?: string
): Promise<boolean> {
  const conflicts = await findConflictingAppointments(
    db,
    doctorId,
    clinicId,
    appointmentDate,
    time,
    duration,
    excludeId
  );
  return conflicts.length > 0;
}

// ==================== BOOKED TIMES ====================

export async function findBookedTimes(db: PrismaClient | Prisma.TransactionClient, doctorId: string, date: Date) {
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
      status: { notIn: ['CANCELLED'] },
      isDeleted: false
    },
    select: {
      time: true
    }
  });
}

// ==================== DOCTOR SCHEDULE ====================

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

// ==================== VALIDATION ====================

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

// ==================== STATISTICS ====================

export interface AppointmentStats {
  averagePerDay?: number;
  byStatus: Array<{
    status: AppointmentStatus;
    count: number;
  }>;
  revenue: number;
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
    period?: 'day' | 'week' | 'month' | 'year';
  }
): Promise<AppointmentStats> {
  const now = new Date();
  let fromDate = options?.fromDate;
  let toDate = options?.toDate;

  if (options?.period && !fromDate && !toDate) {
    switch (options.period) {
      case 'day':
        fromDate = startOfDay(now);
        toDate = endOfDay(now);
        break;
      case 'week':
        fromDate = subDays(now, 7);
        toDate = now;
        break;
      case 'month':
        fromDate = subMonths(now, 1);
        toDate = now;
        break;
      case 'year':
        fromDate = subMonths(now, 12);
        toDate = now;
        break;
      default:
        fromDate = subMonths(now, 1);
        toDate = now;
    }
  }

  const where: Prisma.AppointmentWhereInput = {
    clinicId,
    isDeleted: false,
    ...(fromDate || toDate
      ? {
          appointmentDate: {
            ...(fromDate && { gte: fromDate }),
            ...(toDate && { lte: toDate })
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
        appointmentDate: { gte: now },
        status: { in: ['SCHEDULED', 'PENDING'] }
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

  const daysDiff = fromDate && toDate ? Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) : 30;

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
      ...(reason && { cancellationReason: reason }),
      updatedAt: new Date()
    }
  });
}

// ==================== COUNTS ====================

export async function countAppointments(
  db: PrismaClient,
  clinicId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    status?: AppointmentStatus[];
  }
) {
  const where: Prisma.AppointmentWhereInput = {
    clinicId,
    isDeleted: false,
    ...(options?.startDate || options?.endDate
      ? {
          appointmentDate: {
            ...(options.startDate && { gte: options.startDate }),
            ...(options.endDate && { lte: options.endDate })
          }
        }
      : {}),
    ...(options?.status?.length
      ? {
          status: { in: options.status }
        }
      : {})
  };

  return db.appointment.count({ where });
}

// ==================== GROUPED EXPORT ====================

export const appointmentQueries = {
  // Single
  findById: findAppointmentById,
  findByIdWithMedical: findAppointmentByIdWithMedical,

  // Lists
  find: findAppointments,
  findByPatient: findAppointmentsByPatient,
  findByDoctor: findAppointmentsByDoctor,

  // Time-based
  findToday: findTodayAppointments,
  findUpcoming: findUpcomingAppointments,
  findForMonth: findAppointmentsForMonth,

  // Create/Update
  create: createAppointment,
  update: updateAppointment,
  updateStatus: updateAppointmentStatus,

  // Delete
  softDelete: softDeleteAppointment,
  deletePermanently,
  deleteAllForClinic,

  // Availability
  findBookedTimes,
  findDoctorSchedule,
  findConflicting: findConflictingAppointments,
  checkOverlap: checkAppointmentOverlap,
  validateDoctorAvailability,

  // Stats
  getStats: getAppointmentStats,
  count: countAppointments,

  // Batch
  findByIds: findAppointmentsByIds,
  batchUpdateStatus: batchUpdateAppointmentStatus
} as const;
