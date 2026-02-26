import type { PrismaClient } from '../../generated/client';

/**
 * 🔷 VALIDATION REPOSITORY
 * - ONLY raw Prisma queries
 * - NO business logic
 * - NO date calculations
 */

export async function checkPatientExists(db: PrismaClient, patientId: string, clinicId: string) {
  return db.patient.findFirst({
    where: {
      id: patientId,
      clinicId,
      isDeleted: false
    },
    select: {
      id: true,
      clinicId: true,
      dateOfBirth: true,
      gender: true
    }
  });
}

export async function checkAppointmentExists(db: PrismaClient, appointmentId: string, clinicId: string) {
  return db.appointment.findFirst({
    where: {
      id: appointmentId,
      clinicId,
      isDeleted: false
    },
    select: { id: true }
  });
}

export async function validateClinicAccess(db: PrismaClient, clinicId: string, userId: string) {
  return db.clinicMember.findFirst({
    where: {
      clinicId,
      userId
    },
    select: {
      userId: true,
      clinicId: true,
      role: true
    }
  });
}
