import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '..';

const recentActivitySchema = z.object({
  clinicId: z.string(),
  limit: z.number().min(1).max(50).default(10)
});

// Define proper return types
type AppointmentWithRelations = {
  id: string;
  createdAt: Date;
  patient: {
    firstName: string;
    lastName: string;
  } | null;
  doctor: {
    id: string;
    name: string;
    img: string;
    workingDays: string[];
    colorCode: string;
  } | null;
};

type PatientWithRelations = {
  id: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  createdById: string | null;
  user: {
    name: string;
  } | null;
};

type ImmunizationWithRelations = {
  id: string;
  vaccine: string;
  date: Date;
  patient: {
    firstName: string;
    lastName: string;
  } | null;
  administeredByStaffId: string | null;
  administeredBy: {
    name: string;
  } | null;
};

type PrescriptionWithRelations = {
  id: string;
  createdAt: Date;
  doctorId: string | null;
  patient: {
    firstName: string;
    lastName: string;
  } | null;
  doctor: {
    name: string;
    img: string;
  } | null;
};

type PaymentWithRelations = {
  id: string;
  amountPaid: number | null;
  createdAt: Date;
  patient: {
    firstName: string;
    lastName: string;
  } | null;
};

export const activityRouter = createTRPCRouter({
  /**
   * Get recent activity feed for dashboard
   */
  recent: protectedProcedure.input(recentActivitySchema).query(async ({ ctx, input }) => {
    const { clinicId, limit } = input;

    // Combine multiple activity sources
    const [appointments, patients, immunizations, prescriptions, payments] = await Promise.all([
      // Recent appointments - FIXED: Added id and doctorId to select
      // Recent appointments - FIXED: Added id and doctorId to select
      ctx.db.appointment.findMany({
        where: { clinicId, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 3),
        select: {
          id: true,
          createdAt: true,
          doctorId: true,
          patient: {
            select: { firstName: true, lastName: true }
          },
          doctor: {
            select: {
              id: true,
              name: true,
              img: true,
              workingDays: true,
              colorCode: true
            }
          }
        }
      }) as unknown as Promise<AppointmentWithRelations[]>,

      // New patients - FIXED: Added missing fields
      ctx.db.patient.findMany({
        where: { clinicId, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 3),
        select: {
          id: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          createdById: true,
          user: {
            select: { name: true }
          }
        }
      }) as Promise<PatientWithRelations[]>,

      // Recent immunizations - FIXED: Added missing fields
      ctx.db.immunization.findMany({
        where: {
          patient: { clinicId },
          isDeleted: false
        },
        orderBy: { date: 'desc' },
        take: Math.ceil(limit / 3),
        select: {
          id: true,
          vaccine: true,
          date: true,
          administeredByStaffId: true,
          patient: {
            select: { firstName: true, lastName: true }
          },
          administeredBy: {
            select: { name: true }
          }
        }
      }) as Promise<ImmunizationWithRelations[]>,

      // Recent prescriptions - FIXED: Use select instead of include for consistency
      // Recent prescriptions - FIXED: Use select instead of include for consistency
      ctx.db.prescription.findMany({
        where: {
          clinicId
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 3),
        select: {
          id: true,
          createdAt: true,
          doctorId: true,
          patient: {
            select: { firstName: true, lastName: true }
          },
          doctor: {
            select: { name: true }
          }
        }
      }) as unknown as Promise<PrescriptionWithRelations[]>,

      // Recent payments - FIXED: Added missing fields
      ctx.db.payment.findMany({
        where: {
          clinicId,
          isDeleted: false
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 3),
        select: {
          id: true,
          amountPaid: true,
          createdAt: true,
          patient: {
            select: { firstName: true, lastName: true }
          }
        }
      }) as Promise<PaymentWithRelations[]>
    ]);

    // Transform and combine activities - FIXED: No non-null assertions, safe access with fallbacks
    const activities = [
      ...appointments.map(apt => ({
        id: `apt-${apt.id}`,
        type: 'APPOINTMENT' as const,
        title: 'Appointment Scheduled',
        description: apt.patient
          ? `${apt.patient.firstName} ${apt.patient.lastName}${apt.doctor ? ` with Dr. ${apt.doctor.name}` : ''}`
          : 'Appointment scheduled',
        createdAt: apt.createdAt,
        userId: apt.doctor?.id || null,
        userImage: apt.doctor?.img || null,
        userName: apt.doctor?.name || null,
        link: `/dashboard/appointments/${apt.id}`
      })),

      ...patients.map(patient => ({
        id: `pat-${patient.id}`,
        type: 'PATIENT' as const,
        title: 'New Patient Registered',
        description: `${patient.firstName} ${patient.lastName}`,
        createdAt: patient.createdAt,
        userId: patient.createdById || null,
        userName: patient.user?.name || null,
        userImage: null,
        link: `/dashboard/patients/${patient.id}`
      })),

      ...immunizations.map(imm => ({
        id: `imm-${imm.id}`,
        type: 'IMMUNIZATION' as const,
        title: 'Immunization Administered',
        description: imm.patient
          ? `${imm.vaccine || 'Vaccine'} - ${imm.patient.firstName} ${imm.patient.lastName}`
          : `${imm.vaccine || 'Vaccine'} administered`,
        createdAt: imm.date,
        userId: imm.administeredByStaffId || null,
        userName: imm.administeredBy?.name || null,
        userImage: null,
        link: `/dashboard/immunizations/${imm.id}`
      })),

      ...prescriptions.map(rx => ({
        id: `rx-${rx.id}`,
        type: 'PRESCRIPTION' as const,
        title: 'Prescription Issued',
        description: rx.patient ? `For ${rx.patient.firstName} ${rx.patient.lastName}` : 'Prescription issued',
        createdAt: rx.createdAt,
        userId: rx.doctorId || null,
        userName: rx.doctor?.name || null,
        userImage: rx.doctor?.img || null,
        link: `/dashboard/prescriptions/${rx.id}`
      })),

      ...payments.map(payment => {
        const amount = payment.amountPaid ? `$${Number(payment.amountPaid).toFixed(2)}` : 'Payment';

        return {
          id: `pay-${payment.id}`,
          type: 'PAYMENT' as const,
          title: 'Payment Received',
          description: payment.patient
            ? `${amount} from ${payment.patient.firstName} ${payment.patient.lastName}`
            : `${amount} received`,
          createdAt: payment.createdAt,
          userId: null,
          userName: null,
          userImage: null,
          link: `/dashboard/billing/payments/${payment.id}`
        };
      })
    ];

    // Sort by date (newest first) and limit
    return activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  })
});

// Export type for use in components
export type ActivityItem = Awaited<ReturnType<(typeof activityRouter)['recent']>>[number];
