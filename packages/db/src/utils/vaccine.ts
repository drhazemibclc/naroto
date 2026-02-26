import { prisma } from '../client';
import { toNumber } from './decimal';

// Helper functions
export async function calculateImmunizationsDue(clinicId: string): Promise<number> {
  const patients = await prisma.patient.findMany({
    where: { clinicId, isDeleted: false },
    select: { id: true, dateOfBirth: true }
  });

  const schedule = await prisma.vaccineSchedule.findMany();
  let dueCount = 0;

  for (const patient of patients) {
    const ageDays = Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24));

    // const _immunizations = await prisma.immunization.count({
    //   where: { patientId: patient.id }
    // });

    for (const vaccine of schedule) {
      if (vaccine.ageInDaysMin && ageDays >= vaccine.ageInDaysMin) {
        dueCount++;
      }
    }
  }

  return dueCount;
}

export async function calculateImmunizationsCompleted(
  clinicId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const patients = await prisma.patient.findMany({
    where: { clinicId, isDeleted: false },
    select: { id: true }
  });

  return prisma.immunization.count({
    where: {
      patientId: { in: patients.map((p: { id: string }) => p.id) },
      date: { gte: startDate, lt: endDate }
    }
  });
}

export async function calculateGrowthChecksPending(clinicId: string): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const patients = await prisma.patient.count({
    where: {
      clinicId,
      isDeleted: false,
      OR: [
        { growthRecords: { none: {} } },
        {
          growthRecords: {
            every: { date: { lt: thirtyDaysAgo } }
          }
        }
      ]
    }
  });

  return patients;
}

export async function calculateMonthlyRevenue(clinicId: string, startDate: Date, endDate?: Date): Promise<number> {
  const payments = await prisma.payment.aggregate({
    where: {
      clinicId,
      paymentDate: endDate ? { gte: startDate, lt: endDate } : { gte: startDate },
      status: 'PAID',
      isDeleted: false
    },
    _sum: {
      amountPaid: true
    }
  });

  return toNumber(payments._sum.amountPaid) || 0;
}

export async function calculateAgeInMonths(dateOfBirth: Date): Promise<number> {
  const today = new Date();
  const ageDays = Math.floor((today.getTime() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24));
  return Math.floor(ageDays / 30);
}
