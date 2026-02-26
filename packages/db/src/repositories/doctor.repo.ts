import type { Prisma, PrismaClient } from '../../generated/client';

/**
 * 🔷 DOCTOR REPOSITORY
 * - ONLY raw Prisma queries
 * - NO business logic
 * - NO date calculations
 * - NO dedupeQuery
 */

export interface WorkingDayInput {
  day: string;
  endTime: string;
  startTime: string;
}

// ==================== READ OPERATIONS ====================
export async function countActiveDoctors(db: PrismaClient, clinicId: string): Promise<number> {
  return db.doctor.count({
    where: {
      clinicId,
      isDeleted: false
    }
  });
}
// Add these missing methods to doctor.repo.ts

export async function findDoctorWithAppointments(db: PrismaClient, id: string, clinicId: string) {
  return db.doctor.findUnique({
    where: { id, clinicId, isDeleted: false },
    include: {
      appointments: {
        where: { isDeleted: false },
        orderBy: { appointmentDate: 'desc' },
        take: 10,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      },
      workingDays: true
    }
  });
}

export async function findPaginated(
  db: PrismaClient,
  params: {
    clinicId: string;
    search?: string;
    skip: number;
    take: number;
  }
) {
  const where: Prisma.DoctorWhereInput = {
    clinicId: params.clinicId,
    isDeleted: false
  };

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { specialty: { contains: params.search, mode: 'insensitive' } },
      { email: { contains: params.search, mode: 'insensitive' } }
    ];
  }

  const [doctors, total] = await Promise.all([
    db.doctor.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { name: 'asc' },
      include: {
        workingDays: true
      }
    }),
    db.doctor.count({ where })
  ]);

  return [doctors, total] as const;
}

export async function getDashboardCounts(db: PrismaClient, doctorId: string, clinicId: string, todayStart: Date) {
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [appointments, totalPatients, availableDoctors] = await Promise.all([
    db.appointment.findMany({
      where: {
        doctorId,
        clinicId,
        isDeleted: false,
        appointmentDate: { gte: todayStart }
      },
      orderBy: { appointmentDate: 'desc' },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    }),
    db.appointment
      .groupBy({
        by: ['patientId'],
        where: {
          doctorId,
          clinicId,
          isDeleted: false
        },
        _count: true
      })
      .then(result => result.length),
    db.doctor.count({
      where: {
        clinicId,
        isDeleted: false,
        workingDays: {
          some: {
            day: {
              equals: new Date().toLocaleString('en-US', { weekday: 'long' }).toLowerCase(),
              mode: 'insensitive'
            }
          }
        }
      }
    })
  ]);

  return { appointments, totalPatients, availableDoctors };
}

export async function softDeleteDoctor(
  db: PrismaClient,
  id: string,
  clinicId: string,
  data: { isDeleted: boolean; deletedAt: Date }
) {
  return db.doctor.update({
    where: { id, clinicId },
    data
  });
}

export async function updateDoctor(db: PrismaClient, id: string, clinicId: string, data: Prisma.DoctorCreateInput) {
  return db.doctor.update({
    where: { id, clinicId },
    data
  });
}
export async function findDoctorsWorkingOnDay(
  db: PrismaClient,
  clinicId: string,
  day: string, // This is the parameter passed in
  limit: number
) {
  return db.doctor.findMany({
    take: limit, // Use the limit parameter instead of hardcoded 5
    select: {
      colorCode: true,
      id: true,
      img: true,
      name: true,
      specialty: true
    },
    where: {
      clinicId,
      isDeleted: false,
      workingDays: {
        some: {
          day: {
            equals: day, // Use 'day' from arguments, not 'todayDayName'
            mode: 'insensitive'
          }
        }
      }
    }
  });
}
export async function findDoctorList(db: PrismaClient, clinicId: string) {
  return db.doctor.findMany({
    where: { clinicId, isDeleted: false },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      specialty: true,
      img: true,
      colorCode: true,
      availableFromTime: true,
      availableToTime: true,
      status: true,
      isActive: true,
      userId: true,
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

export async function findDoctorById(db: PrismaClient, id: string, clinicId: string) {
  return db.doctor.findUnique({
    where: {
      id,
      clinicId,
      isDeleted: false
    },
    include: {
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

export async function countDoctorUpcomingAppointments(db: PrismaClient, doctorId: string, currentDate: Date) {
  return db.appointment.count({
    where: {
      doctorId,
      appointmentDate: { gte: currentDate },
      status: { in: ['SCHEDULED', 'PENDING'] },
      isDeleted: false
    }
  });
}

export async function countAvailableDoctors(db: PrismaClient, clinicId: string, date: Date): Promise<number> {
  const day = date.toLocaleString('en-US', { weekday: 'long' });
  return db.doctor.count({
    where: {
      clinicId,
      isDeleted: false,
      workingDays: {
        some: { day: { equals: day, mode: 'insensitive' } }
      }
    }
  });
}
export async function findDoctorWithSchedule(db: PrismaClient | Prisma.TransactionClient, id: string) {
  return db.doctor.findUnique({
    where: { id },
    select: {
      // Assuming 'workingDays' is a related model in your schema.prisma
      workingDays: true,
      availableFromTime: true,
      availableToTime: true
    }
  });
}

// ==================== CREATE OPERATIONS ====================

export async function createDoctor(
  db: PrismaClient,
  data: Prisma.DoctorCreateInput & { createdAt: Date; updatedAt: Date }
) {
  return db.doctor.create({ data });
}

export async function createWorkingDays(
  db: PrismaClient,
  data: Array<{
    day: string;
    clinicId: string;
    startTime: string;
    endTime: string;
    doctorId: string;
  }>
) {
  return db.workingDays.createMany({
    data
  });
}

export async function deleteWorkingDays(db: PrismaClient, doctorId: string) {
  return db.workingDays.deleteMany({
    where: { doctorId }
  });
}

// ==================== DELETE OPERATIONS ====================

export async function deleteDoctor(db: PrismaClient, id: string, clinicId: string) {
  return db.doctor.delete({
    where: { id, clinicId }
  });
}

// ==================== WORKING DAYS ====================

export async function findDoctorWorkingDays(db: PrismaClient, doctorId: string) {
  return db.workingDays.findMany({
    where: { doctorId },
    select: {
      day: true,
      startTime: true,
      endTime: true
    }
  });
}
