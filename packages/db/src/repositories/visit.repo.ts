/**
 * 🔵 VISIT REPOSITORY
 * - ONLY raw Prisma database queries
 * - NO business logic, validation, or error handling
 * - NO cache directives
 * - ALL queries accept db client as first parameter
 */

import type { AppointmentStatus, Prisma, PrismaClient } from '../../generated/client';
import type { AppointmentType } from '../types';

// ==================== READ OPERATIONS ====================
export async function hardDeleteVisit(db: PrismaClient, id: string) {
  return db.appointment.delete({
    where: { id }
  });
}
export async function findVisitById(db: PrismaClient, id: string) {
  return db.appointment.findUnique({
    where: {
      id,
      isDeleted: false
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          phone: true,
          email: true,
          image: true,
          colorCode: true,
          clinicId: true
        }
      },
      doctor: {
        select: {
          id: true,
          name: true,
          specialty: true,
          email: true,
          img: true,
          colorCode: true,
          workingDays: true
        }
      },
      service: {
        select: {
          id: true,
          serviceName: true,
          price: true,
          duration: true
        }
      },
      medical: {
        select: {
          id: true,
          createdAt: true
        }
      }
    }
  });
}

export async function findVisitsByPatient(
  db: PrismaClient,
  patientId: string,
  options?: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
    status?: AppointmentStatus | AppointmentStatus[];
  }
) {
  const where: Prisma.AppointmentWhereInput = {
    patientId,
    isDeleted: false
  };

  if (options?.status) {
    where.status = Array.isArray(options.status) ? { in: options.status } : options.status;
  }

  if (options?.startDate || options?.endDate) {
    where.appointmentDate = {};
    if (options.startDate) where.appointmentDate.gte = options.startDate;
    if (options.endDate) where.appointmentDate.lte = options.endDate;
  }

  return db.appointment.findMany({
    where,
    orderBy: { appointmentDate: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          specialty: true,
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
    }
  });
}

export async function findVisitsByClinic(
  db: PrismaClient,
  clinicId: string,
  options?: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
    status?: AppointmentStatus | AppointmentStatus[];
    doctorId?: string;
    patientId?: string;
    search?: string;
  }
) {
  const where: Prisma.AppointmentWhereInput = {
    clinicId,
    isDeleted: false
  };

  if (options?.startDate || options?.endDate) {
    where.appointmentDate = {};
    if (options.startDate) where.appointmentDate.gte = options.startDate;
    if (options.endDate) where.appointmentDate.lte = options.endDate;
  }

  if (options?.status) {
    where.status = Array.isArray(options.status) ? { in: options.status } : options.status;
  }

  if (options?.doctorId) {
    where.doctorId = options.doctorId;
  }

  if (options?.patientId) {
    where.patientId = options.patientId;
  }

  if (options?.search) {
    where.OR = [
      {
        patient: {
          OR: [
            { firstName: { contains: options.search, mode: 'insensitive' } },
            { lastName: { contains: options.search, mode: 'insensitive' } },
            { phone: { contains: options.search, mode: 'insensitive' } }
          ]
        }
      },
      {
        doctor: {
          name: { contains: options.search, mode: 'insensitive' }
        }
      }
    ];
  }

  return db.appointment.findMany({
    where,
    orderBy: { appointmentDate: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          phone: true,
          image: true,
          colorCode: true
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
          price: true,
          duration: true
        }
      }
    }
  });
}

export async function findVisitsByDateRange(
  db: PrismaClient,
  clinicId: string,
  startDate: Date,
  endDate: Date,
  options?: {
    doctorId?: string;
    status?: AppointmentStatus[];
  }
) {
  const where: Prisma.AppointmentWhereInput = {
    clinicId,
    isDeleted: false,
    appointmentDate: {
      gte: startDate,
      lte: endDate
    }
  };

  if (options?.doctorId) {
    where.doctorId = options.doctorId;
  }

  if (options?.status && options.status.length > 0) {
    where.status = { in: options.status };
  }

  return db.appointment.findMany({
    where,
    orderBy: { appointmentDate: 'asc' },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          colorCode: true
        }
      },
      doctor: {
        select: {
          id: true,
          name: true,
          colorCode: true
        }
      }
    }
  });
}

export async function findUpcomingVisits(
  db: PrismaClient,
  clinicId: string,
  options?: {
    limit?: number;
    doctorId?: string;
    fromDate?: Date;
  }
) {
  const where: Prisma.AppointmentWhereInput = {
    clinicId,
    isDeleted: false,
    appointmentDate: { gte: options?.fromDate || new Date() },
    status: { in: ['SCHEDULED', 'COMPLETED', 'PENDING'] }
  };

  if (options?.doctorId) {
    where.doctorId = options.doctorId;
  }

  return db.appointment.findMany({
    where,
    orderBy: { appointmentDate: 'asc' },
    take: options?.limit || 20,
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          image: true,
          colorCode: true
        }
      },
      doctor: {
        select: {
          id: true,
          name: true,
          specialty: true,
          img: true
        }
      },
      service: {
        select: {
          id: true,
          serviceName: true,
          duration: true
        }
      }
    }
  });
}

// ==================== COUNT OPERATIONS ====================

export async function countVisits(
  db: PrismaClient,
  clinicId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    status?: AppointmentStatus | AppointmentStatus[];
    doctorId?: string;
  }
) {
  const where: Prisma.AppointmentWhereInput = {
    clinicId,
    isDeleted: false
  };

  if (options?.startDate || options?.endDate) {
    where.appointmentDate = {};
    if (options.startDate) where.appointmentDate.gte = options.startDate;
    if (options.endDate) where.appointmentDate.lte = options.endDate;
  }

  if (options?.status) {
    where.status = Array.isArray(options.status) ? { in: options.status } : options.status;
  }

  if (options?.doctorId) {
    where.doctorId = options.doctorId;
  }

  return db.appointment.count({ where });
}

export async function countVisitsByStatus(db: PrismaClient, clinicId: string, startDate?: Date, endDate?: Date) {
  const where: Prisma.AppointmentWhereInput = {
    clinicId,
    isDeleted: false
  };

  if (startDate || endDate) {
    where.appointmentDate = {};
    if (startDate) where.appointmentDate.gte = startDate;
    if (endDate) where.appointmentDate.lte = endDate;
  }

  const appointments = await db.appointment.groupBy({
    by: ['status'],
    where,
    _count: true
  });

  return appointments.reduce(
    (acc, curr) => {
      if (curr.status) acc[curr.status] = curr._count;
      return acc;
    },
    {} as Record<AppointmentStatus, number>
  );
}

// ==================== WRITE OPERATIONS ====================

export async function createVisit(
  db: PrismaClient,
  data: {
    id: string;
    clinicId: string;
    patientId: string;
    doctorId: string;
    serviceId?: string | null;
    appointmentDate: Date;
    time?: string | null;
    duration?: number | null;
    type: AppointmentType;
    reason?: string | null;
    notes?: string | null;
    status: AppointmentStatus;
    appointmentPrice?: number | null;
    createdById?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
) {
  return db.appointment.create({
    data,
    include: {
      patient: {
        select: {
          id: true,
          clinicId: true,
          firstName: true,
          lastName: true
        }
      },
      doctor: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
}

export async function updateVisit(
  db: PrismaClient,
  id: string,
  data: Partial<{
    doctorId: string;
    serviceId: string | null;
    appointmentDate: Date;
    time: string | null;
    duration: number | null;
    type: AppointmentType;
    reason: string | null;
    notes: string | null;
    status: AppointmentStatus;
    appointmentPrice: number | null;
    updatedAt: Date;
  }>
) {
  return db.appointment.update({
    where: { id },
    data,
    include: {
      patient: {
        select: {
          id: true,
          clinicId: true
        }
      }
    }
  });
}

export async function updateVisitStatus(db: PrismaClient, id: string, status: AppointmentStatus, updatedAt: Date) {
  return db.appointment.update({
    where: { id },
    data: { status, updatedAt },
    include: {
      patient: {
        select: {
          id: true,
          clinicId: true
        }
      }
    }
  });
}

export async function softDeleteVisit(
  db: PrismaClient,
  id: string,
  data: {
    isDeleted: boolean;
    deletedAt: Date;
    updatedAt: Date;
  }
) {
  return db.appointment.update({
    where: { id },
    data
  });
}

// ==================== BULK OPERATIONS ====================

export async function createManyVisits(
  db: PrismaClient,
  visits: Array<{
    id: string;
    clinicId: string;
    type: AppointmentType;
    patientId: string;
    doctorId: string;
    appointmentDate: Date;
    status: AppointmentStatus;
    createdAt: Date;
    updatedAt: Date;
  }>
) {
  return db.appointment.createMany({
    data: visits,
    skipDuplicates: true
  });
}

export async function updateVisitsStatus(db: PrismaClient, ids: string[], status: AppointmentStatus, updatedAt: Date) {
  return db.appointment.updateMany({
    where: { id: { in: ids } },
    data: { status, updatedAt }
  });
}

// ==================== VALIDATION QUERIES ====================

export async function findOverlappingVisits(
  db: PrismaClient,
  doctorId: string,
  appointmentDate: Date,
  duration: number,
  excludeId?: string
) {
  const startTime = new Date(appointmentDate);
  const endTime = new Date(appointmentDate.getTime() + duration * 60_000);

  return db.appointment.findFirst({
    where: {
      doctorId,
      isDeleted: false,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      appointmentDate: {
        gte: new Date(startTime.getTime() - 30 * 60_000), // 30 min before
        lte: new Date(endTime.getTime() + 30 * 60_000) // 30 min after
      },
      ...(excludeId && { id: { not: excludeId } })
    }
  });
}

export async function findVisitsByAppointmentIds(db: PrismaClient, appointmentIds: string[]) {
  return db.appointment.findMany({
    where: {
      id: { in: appointmentIds },
      isDeleted: false
    },
    select: {
      id: true,
      patientId: true,
      doctorId: true,
      clinicId: true,
      status: true
    }
  });
}

// ==================== AGGREGATION QUERIES ====================

export async function getVisitStatistics(db: PrismaClient, clinicId: string, startDate: Date, endDate: Date) {
  const [total, byStatus, byDoctor, revenue] = await Promise.all([
    db.appointment.count({
      where: {
        clinicId,
        isDeleted: false,
        appointmentDate: { gte: startDate, lte: endDate }
      }
    }),
    db.appointment.groupBy({
      by: ['status'],
      where: {
        clinicId,
        isDeleted: false,
        appointmentDate: { gte: startDate, lte: endDate }
      },
      _count: true
    }),
    db.appointment.groupBy({
      by: ['doctorId'],
      where: {
        clinicId,
        isDeleted: false,
        appointmentDate: { gte: startDate, lte: endDate }
      },
      _count: true
    }),
    db.appointment.aggregate({
      where: {
        clinicId,
        isDeleted: false,
        appointmentDate: { gte: startDate, lte: endDate },
        status: 'COMPLETED',
        appointmentPrice: { not: null }
      },
      _sum: { appointmentPrice: true }
    })
  ]);

  return {
    total,
    byStatus: byStatus.reduce(
      (acc, curr) => {
        if (curr.status) acc[curr.status] = curr._count;
        return acc;
      },
      {} as Record<string, number>
    ),
    byDoctor,
    revenue: revenue._sum.appointmentPrice || 0
  };
}
