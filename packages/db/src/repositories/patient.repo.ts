import type { AppointmentStatus, Gender, Prisma, PrismaClient, Status } from '@generated/client';

/**
 * 🔵 PURE QUERY LAYER
 * - ONLY raw Prisma queries
 * - NO business logic (if/else, throw)
 * - NO cache directives
 * - NO session/auth
 * - All functions accept PrismaClient as first parameter
 */

// ==================== SINGLE PATIENT ====================

export async function countActivePatients(db: PrismaClient, clinicId: string): Promise<number> {
  return db.patient.count({
    where: {
      clinicId,
      isDeleted: false
    }
  });
}

export async function searchPatients(
  db: PrismaClient,
  params: {
    clinicId: string;
    query: string;
    searchBy?: 'name' | 'phone' | 'email';
    limit?: number;
  }
) {
  const { clinicId, query, searchBy = 'name', limit = 10 } = params;

  const whereClause =
    searchBy === 'phone'
      ? { phone: { contains: query, mode: 'insensitive' as const } }
      : searchBy === 'email'
        ? { email: { contains: query, mode: 'insensitive' as const } }
        : {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' as const } },
              { lastName: { contains: query, mode: 'insensitive' as const } }
            ]
          };

  return db.patient.findMany({
    where: {
      clinicId,
      isDeleted: false,
      ...whereClause
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      gender: true,
      phone: true,
      image: true,
      colorCode: true
    }
  });
}

export async function findPatientsWithFilters(
  db: PrismaClient,
  clinicId: string,
  filters: {
    search?: string;
    doctorId?: string;
    skip?: number;
    take?: number;
  }
) {
  const { search, doctorId, skip = 0, take = 20 } = filters;

  return db.patient.findMany({
    where: {
      clinicId,
      isDeleted: false,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(doctorId && { doctorId })
    },
    include: {
      appointments: {
        include: {
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true
            }
          }
        }
      }
    },
    skip,
    take,
    orderBy: { lastName: 'asc' }
  });
}

export async function countNewPatientsInRange(
  db: PrismaClient,
  clinicId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  return db.patient.count({
    where: {
      clinicId,
      isDeleted: false,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    }
  });
}

export async function getPatientById(db: PrismaClient, id: string, clinicId: string) {
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
      },
      appointments: {
        select: {
          appointmentDate: true,
          status: true,
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true
            }
          }
        },
        orderBy: { appointmentDate: 'desc' },
        take: 5
      }
    }
  });
}

export async function getPatientCountByDoctor(
  db: PrismaClient,
  clinicId: string
): Promise<Array<{ doctorId: string; count: number }>> {
  return db.$queryRaw`
    SELECT "doctorId", COUNT(*) as count
    FROM patients
    WHERE "clinicId" = ${clinicId} AND "isDeleted" = false
    GROUP BY "doctorId"
  `;
}
export async function findRecentPatients(
  db: PrismaClient,
  clinicId: string,
  limit: number
): Promise<
  Array<{
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    image: string | null;
    colorCode: string | null;
    _count: {
      encounters: number;
      appointments: number;
    };
  }>
> {
  return db.patient.findMany({
    where: {
      clinicId,
      isDeleted: false
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      image: true,
      colorCode: true,
      _count: {
        select: {
          encounters: true,
          appointments: true
        }
      },
      appointments: {
        take: 1,
        orderBy: { appointmentDate: 'desc' },
        select: { appointmentDate: true }
      }
    }
  });
}

export async function findPatientByIdWithFullData(db: PrismaClient, id: string, clinicId: string) {
  return db.patient.findFirst({
    where: {
      OR: [{ id }, { email: id }],
      clinicId,
      isDeleted: false
    },
    include: {
      _count: {
        select: {
          appointments: {
            where: { isDeleted: false }
          },
          prescriptions: true,
          medicalRecords: true
        }
      },
      appointments: {
        select: {
          appointmentDate: true,
          status: true,
          doctor: {
            select: {
              name: true,
              specialty: true
            }
          }
        },
        orderBy: { appointmentDate: 'desc' },
        take: 1
      },
      user: {
        select: {
          name: true,
          email: true,
          image: true
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

// ==================== LIST PATIENTS ====================

export async function findPatientsByClinic(
  db: PrismaClient,
  clinicId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
) {
  return db.patient.findMany({
    where: {
      clinicId,
      isDeleted: false
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      gender: true,
      phone: true,
      email: true,
      image: true,
      colorCode: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          appointments: {
            where: { isDeleted: false }
          }
        }
      }
    }
  });
}

export async function findAllPatientsByClinic(db: PrismaClient, clinicId: string) {
  return db.patient.findMany({
    where: {
      clinicId,
      isDeleted: false
    },
    orderBy: { firstName: 'asc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      gender: true,
      phone: true,
      email: true,
      image: true,
      colorCode: true,
      status: true,
      createdAt: true
    }
  });
}

// ==================== PAGINATED WITH SEARCH ====================

export interface FindPatientsPaginatedParams {
  clinicId: string;
  doctorId?: string;
  fromDate?: Date;
  gender?: Gender;
  search?: string;
  skip: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: Status;
  take: number;
  toDate?: Date;
}

export async function findPatientsPaginated(
  db: PrismaClient,
  params: FindPatientsPaginatedParams
): Promise<
  [
    Prisma.PatientGetPayload<{
      include: typeof PAGINATED_INCLUDE;
    }>[],
    number
  ]
> {
  const {
    clinicId,
    skip,
    take,
    search,
    status,
    gender,
    doctorId,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    fromDate,
    toDate
  } = params;

  const where = {
    clinicId,
    isDeleted: false,
    ...(status && { status }),
    ...(gender && { gender }),
    ...(doctorId && { doctorId }),
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate && { gte: fromDate }),
            ...(toDate && { lte: toDate })
          }
        }
      : {}),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { id: { contains: search, mode: 'insensitive' as const } }
      ]
    })
  };

  const orderBy = {
    [sortBy]: sortOrder
  };

  const include = {
    _count: {
      select: {
        appointments: {
          where: { isDeleted: false }
        },
        prescriptions: true,
        medicalRecords: true
      }
    },
    appointments: {
      select: {
        appointmentDate: true
      },
      orderBy: { appointmentDate: 'desc' as const },
      take: 1
    }
  } satisfies Prisma.PatientInclude;

  return Promise.all([
    db.patient.findMany({
      where,
      include,
      skip,
      take,
      orderBy
    }),
    db.patient.count({ where })
  ]);
}

const PAGINATED_INCLUDE = {
  _count: {
    select: {
      appointments: {
        where: { isDeleted: false }
      },
      prescriptions: true,
      medicalRecords: true
    }
  },
  appointments: {
    select: {
      appointmentDate: true
    },
    orderBy: { appointmentDate: 'desc' as const },
    take: 1
  }
} as const;

// ==================== DOCTOR AVAILABILITY ====================

export async function findAvailableDoctorsByDay(db: PrismaClient, day: string, clinicId: string) {
  return db.doctor.findMany({
    where: {
      clinicId,
      isDeleted: false,
      workingDays: {
        some: {
          day: {
            equals: day,
            mode: 'insensitive'
          }
        }
      }
    },
    select: {
      id: true,
      name: true,
      specialty: true,
      img: true,
      workingDays: true,
      colorCode: true
    },
    take: 4
  });
}

// ==================== DASHBOARD STATS ====================

export async function findPatientDashboardStats(db: PrismaClient, patientId: string, clinicId: string) {
  return Promise.all([
    db.patient.findUnique({
      where: {
        id: patientId,
        clinicId,
        isDeleted: false
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        gender: true,
        dateOfBirth: true,
        image: true,
        colorCode: true,
        bloodGroup: true,
        allergies: true,
        medicalConditions: true,
        createdAt: true
      }
    }),
    db.appointment.findMany({
      where: {
        patientId,
        clinicId,
        isDeleted: false
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            img: true,
            specialty: true,
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
      orderBy: { appointmentDate: 'desc' }
    }),
    db.prescription.count({
      where: {
        patientId,
        clinicId,
        status: 'active'
      }
    }),
    db.medicalRecords.count({
      where: {
        patientId,
        clinicId,
        isDeleted: false
      }
    })
  ]);
}

// ==================== PATIENT ENCOUNTERS ====================

export async function findPatientEncounters(
  db: PrismaClient,
  patientId: string,
  clinicId: string,
  options?: {
    limit?: number;
    offset?: number;
    fromDate?: Date;
    toDate?: Date;
  }
) {
  const { limit = 20, offset = 0, fromDate, toDate } = options || {};

  return db.medicalRecords.findMany({
    where: {
      patientId,
      clinicId,
      isDeleted: false,
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate && { gte: fromDate }),
              ...(toDate && { lte: toDate })
            }
          }
        : {})
    },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          specialty: true
        }
      },
      vitalSigns: true,
      encounter: true,
      prescriptions: true
    },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit
  });
}

// ==================== PATIENT APPOINTMENTS ====================

export async function findPatientAppointments(
  db: PrismaClient,
  patientId: string,
  clinicId: string,
  options?: {
    limit?: number;
    offset?: number;
    status?: AppointmentStatus;
    fromDate?: Date;
    toDate?: Date;
  }
) {
  const { limit = 20, offset = 0, status, fromDate, toDate } = options || {};

  return db.appointment.findMany({
    where: {
      patientId,
      clinicId,
      isDeleted: false,
      ...(status && { status }),
      ...(fromDate || toDate
        ? {
            appointmentDate: {
              ...(fromDate && { gte: fromDate }),
              ...(toDate && { lte: toDate })
            }
          }
        : {})
    },
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
    },
    orderBy: { appointmentDate: 'desc' },
    skip: offset,
    take: limit
  });
}

// ==================== PATIENT PRESCRIPTIONS ====================

export async function findPatientPrescriptions(
  db: PrismaClient,
  patientId: string,
  clinicId: string,
  options?: {
    limit?: number;
    offset?: number;
    status?: 'active' | 'completed' | 'cancelled';
  }
) {
  const { limit = 20, offset = 0, status } = options || {};

  return db.prescription.findMany({
    where: {
      patientId,
      clinicId,
      ...(status && { status })
    },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          specialty: true
        }
      },
      prescribedItems: { include: { drug: true } }
    },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit
  });
}

// ==================== MEDICAL RECORDS ====================

export async function findPatientMedicalRecords(
  db: PrismaClient,
  patientId: string,
  clinicId: string,
  options?: {
    limit?: number;
    offset?: number;
    type?: string;
  }
) {
  const { limit = 20, offset = 0, type } = options || {};

  return db.medicalRecords.findMany({
    where: {
      patientId,
      clinicId,
      isDeleted: false,
      ...(type && { type })
    },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          specialty: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit
  });
}

// ==================== COUNTS ====================

export async function countPatientsByClinic(db: PrismaClient, clinicId: string): Promise<number> {
  return db.patient.count({
    where: {
      clinicId,
      isDeleted: false
    }
  });
}

export async function countPatientsByStatus(db: PrismaClient, clinicId: string, status: Status): Promise<number> {
  return db.patient.count({
    where: {
      clinicId,
      status,
      isDeleted: false
    }
  });
}

export async function countPatientsByGender(db: PrismaClient, clinicId: string, gender: Gender): Promise<number> {
  return db.patient.count({
    where: {
      clinicId,
      gender,
      isDeleted: false
    }
  });
}

export async function countPatientsByAgeRange(
  db: PrismaClient,
  clinicId: string,
  minAge: number,
  maxAge: number
): Promise<number> {
  const today = new Date();
  const maxDate = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
  const minDate = new Date(today.getFullYear() - maxAge - 1, today.getMonth(), today.getDate());

  return db.patient.count({
    where: {
      clinicId,
      isDeleted: false,
      dateOfBirth: {
        lte: maxDate,
        gte: minDate
      }
    }
  });
}

// ==================== AGGREGATIONS ====================

export interface PatientStatsByDoctor {
  appointmentCount: number;
  doctorId: string;
  doctorName: string;
  patientCount: number;
}

export async function getPatientStatsByDoctor(db: PrismaClient, clinicId: string): Promise<PatientStatsByDoctor[]> {
  const results = await db.$queryRaw<
    Array<{ doctorId: string; doctorName: string; patientCount: bigint; appointmentCount: bigint }>
  >`
    SELECT 
      d.id as "doctorId",
      d.name as "doctorName",
      COUNT(DISTINCT p.id) as "patientCount",
      COUNT(DISTINCT a.id) as "appointmentCount"
    FROM doctors d
    LEFT JOIN patients p ON p."doctorId" = d.id AND p."isDeleted" = false
    LEFT JOIN appointments a ON a."doctorId" = d.id AND a."isDeleted" = false
    WHERE d."clinicId" = ${clinicId} AND d."isDeleted" = false
    GROUP BY d.id, d.name
  `;

  return results.map(r => ({
    ...r,
    patientCount: Number(r.patientCount),
    appointmentCount: Number(r.appointmentCount)
  }));
}

export async function getPatientRegistrationTrend(
  db: PrismaClient,
  clinicId: string,
  period: 'day' | 'week' | 'month' = 'month',
  limit = 12
): Promise<Array<{ period: string; count: number }>> {
  let interval: string;
  switch (period) {
    case 'day':
      interval = 'day';
      break;
    case 'week':
      interval = 'week';
      break;
    default:
      interval = 'month';
  }

  const results = await db.$queryRaw<Array<{ period: string; count: bigint }>>`
    SELECT 
      DATE_TRUNC(${interval}, "createdAt") as period,
      COUNT(*) as count
    FROM patients
    WHERE "clinicId" = ${clinicId} 
      AND "isDeleted" = false
      AND "createdAt" >= NOW() - (${limit} || ' ' || ${interval})::INTERVAL
    GROUP BY period
    ORDER BY period DESC
    LIMIT ${limit}
  `;

  return results.map(r => ({
    period: r.period,
    count: Number(r.count)
  }));
}

// ==================== VALIDATION ====================

export async function findPatientByEmail(
  db: PrismaClient,
  email: string,
  clinicId: string
): Promise<{ id: string } | null> {
  return db.patient.findFirst({
    where: {
      email,
      clinicId,
      isDeleted: false
    },
    select: { id: true }
  });
}

export async function findPatientByPhone(
  db: PrismaClient,
  phone: string,
  clinicId: string
): Promise<{ id: string } | null> {
  return db.patient.findFirst({
    where: {
      phone,
      clinicId,
      isDeleted: false
    },
    select: { id: true }
  });
}

export async function checkPatientExists(db: PrismaClient, patientId: string, clinicId?: string) {
  const where: Prisma.PatientWhereUniqueInput = { id: patientId, clinicId };

  return db.patient.findUnique({
    where,
    select: {
      id: true,
      clinicId: true,
      dateOfBirth: true,
      gender: true
    }
  });
}

export async function DoesPatientExist(db: PrismaClient, id: string, clinicId: string): Promise<boolean> {
  const count = await db.patient.count({
    where: {
      id,
      clinicId,
      isDeleted: false
    }
  });
  return count > 0;
}

export async function countPatientsCheckedIn(db: PrismaClient, clinicId: string): Promise<number> {
  return db.appointment.count({
    where: {
      clinicId,
      status: 'PENDING',
      isDeleted: false,
      appointmentDate: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
        lt: new Date(new Date().setHours(23, 59, 59, 999))
      }
    }
  });
}

export async function archivePatient(db: PrismaClient, id: string, clinicId: string, data: { deletedAt: Date }) {
  return db.patient.update({
    where: { id, clinicId },
    data: { isDeleted: true, ...data }
  });
}

// ==================== MUTATIONS (Internal - Called by Service) ====================
// These are NOT exported directly, only used via service layer

export async function createPatientInternal(db: PrismaClient, data: Prisma.PatientUncheckedCreateInput) {
  return db.patient.create({
    data: {
      ...data,
      status: 'ACTIVE'
    }
  });
}

export async function updatePatientInternal(
  db: PrismaClient,
  id: string,
  clinicId: string,
  data: Prisma.PatientUncheckedUpdateInput
) {
  return db.patient.update({
    where: {
      id,
      clinicId
    },
    data
  });
}

export async function softDeletePatientInternal(db: PrismaClient, id: string, clinicId: string) {
  return db.patient.update({
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

export async function hardDeletePatientInternal(db: PrismaClient, id: string, clinicId: string) {
  return db.patient.delete({
    where: {
      id,
      clinicId
    }
  });
}

/**
 * 📦 Grouped Export for convenience
 * This allows you to use: import { patientQueries } from '@repo/db/patient'
 */
export const patientQueries = {
  // Single Patient
  findById: (db: PrismaClient, id: string, clinicId: string) =>
    db.patient.findUnique({
      where: { id, clinicId, isDeleted: false },
      include: {
        user: { select: { name: true, email: true, image: true } }
      }
    }),
  findRecent: findRecentPatients,
  findByIdWithFullData: findPatientByIdWithFullData,

  // List Patients
  findByClinic: findPatientsByClinic,
  findAllByClinic: findAllPatientsByClinic,

  // Paginated with Search
  findPaginated: findPatientsPaginated,
  findAvailableDoctorsByDay,

  // Dashboard Stats
  findDashboardStats: findPatientDashboardStats,

  // Encounters & Appointments
  findEncounters: findPatientEncounters,
  findAppointments: findPatientAppointments,
  findPrescriptions: findPatientPrescriptions,
  findMedicalRecords: findPatientMedicalRecords,

  // Counts
  countByClinic: countPatientsByClinic,
  countByStatus: countPatientsByStatus,
  countByGender: countPatientsByGender,
  countByAgeRange: countPatientsByAgeRange,

  // Aggregations
  getStatsByDoctor: getPatientStatsByDoctor,
  getRegistrationTrend: getPatientRegistrationTrend,

  // Validation
  existsByEmail: findPatientByEmail,
  existsByPhone: findPatientByPhone,
  exists: checkPatientExists,

  // Mutations (Internal)
  _create: createPatientInternal,
  _update: updatePatientInternal,
  _delete: softDeletePatientInternal,
  _hardDelete: hardDeletePatientInternal
} as const;
