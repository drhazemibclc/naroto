import type { PrismaClient } from '../../generated/client';

/**
 * 🔷 PRESCRIPTION REPOSITORY
 * - ONLY raw Prisma queries
 * - NO business logic
 * - NO date calculations
 * - NO dedupeQuery
 */

// ==================== READ OPERATIONS ====================

export async function findPrescriptionsByMedicalRecord(
  db: PrismaClient,
  medicalRecordId: string,
  options?: { limit?: number; offset?: number }
) {
  return db.prescription.findMany({
    where: {
      medicalRecordId
    },
    include: {
      doctor: {
        select: {
          id: true,
          name: true
        }
      },
      prescribedItems: {
        include: {
          drug: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      encounter: {
        select: {
          id: true,
          diagnosis: true
        }
      }
    },
    orderBy: { issuedDate: 'desc' },
    take: options?.limit || 20,
    skip: options?.offset || 0
  });
}

export async function findActivePrescriptionsByPatient(db: PrismaClient, patientId: string, currentDate: Date) {
  return db.prescription.findMany({
    where: {
      patientId,
      status: 'active',
      endDate: { gte: currentDate }
    },
    include: {
      doctor: {
        select: {
          id: true,
          name: true
        }
      },
      prescribedItems: {
        include: {
          drug: true
        }
      }
    },
    orderBy: { issuedDate: 'desc' }
  });
}
