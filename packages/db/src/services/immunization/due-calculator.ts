// src/services/immunization/due-calculator.ts
import { prisma } from '../../client';

interface VaccineDue {
  ageInDays: number;
  dueDate: Date;
  patientId: string;
  priority: 'high' | 'medium' | 'low';
  vaccineName: string;
}

export class ImmunizationService {
  /**
   * Calculate immunizations due for a patient
   */
  async calculateDueVaccines(patientId: string): Promise<VaccineDue[]> {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { dateOfBirth: true }
    });

    if (!patient) {
      throw new Error('Patient not found');
    }

    const ageDays = Math.floor((Date.now() - patient.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));

    // Get vaccine schedule
    const schedule = await prisma.vaccineSchedule.findMany({
      orderBy: { ageInDaysMin: 'asc' }
    });

    // Get already administered vaccines
    const givenVaccines = await prisma.immunization.findMany({
      where: { patientId },
      select: { vaccine: true }
    });

    const givenSet = new Set(givenVaccines.map(v => v.vaccine));

    const dueVaccines: VaccineDue[] = [];

    for (const vaccine of schedule) {
      if (givenSet.has(vaccine.vaccineName)) continue;

      const ageMin = vaccine.ageInDaysMin || 0;
      const ageMax = vaccine.ageInDaysMax || Number.POSITIVE_INFINITY;

      if (ageDays >= ageMin && ageDays <= ageMax) {
        dueVaccines.push({
          patientId,
          vaccineName: vaccine.vaccineName,
          dueDate: new Date(patient.dateOfBirth.getTime() + ageMin * 24 * 60 * 60 * 1000),
          ageInDays: ageMin,
          priority: ageDays - ageMin > 30 ? 'high' : 'medium'
        });
      }
    }

    return dueVaccines;
  }

  /**
   * Get clinic-wide due count
   */
  async getClinicDueCount(clinicId: string): Promise<number> {
    const patients = await prisma.patient.findMany({
      where: {
        clinicId,
        isDeleted: false
      },
      select: { id: true, dateOfBirth: true }
    });

    const schedule = await prisma.vaccineSchedule.findMany();
    let dueCount = 0;

    for (const patient of patients) {
      // const _ageDays = Math.floor((Date.now() - patient.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));

      const givenVaccines = await prisma.immunization.count({
        where: { patientId: patient.id }
      });

      // Simplified logic - in production you'd check each vaccine
      dueCount += Math.max(0, schedule.length - givenVaccines);
    }

    return dueCount;
  }
}

export const immunizationService = new ImmunizationService();
