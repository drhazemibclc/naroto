/**
 * 🟣 MEDICAL MODULE - tRPC ROUTER
 *
 * RESPONSIBILITIES:
 * - tRPC procedure definitions
 * - Permission checks
 * - Input validation via schema
 * - Delegates to cache layer
 * - NO business logic
 * - NO database calls
 */

import {
  DiagnosisByAppointmentSchema,
  DiagnosisByIdSchema,
  DiagnosisByMedicalRecordSchema,
  VitalSignsByIdSchema,
  VitalSignsByMedicalRecordSchema,
  VitalSignsByPatientSchema
} from '@naroto/db/zodSchemas/encounter.schema';
import {
  DiagnosisCreateSchema,
  DiagnosisFilterSchema,
  DiagnosisUpdateSchema,
  LabTestByIdSchema,
  LabTestByMedicalRecordSchema,
  LabTestCreateSchema,
  LabTestFilterSchema,
  LabTestUpdateSchema,
  MedicalRecordByIdSchema,
  MedicalRecordCreateSchema,
  MedicalRecordFilterSchema,
  PrescriptionFilterSchema,
  VitalSignsCreateSchema,
  VitalSignsUpdateSchema
} from '@naroto/db/zodSchemas/index';
import type { AnyRouter } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '..';
import {
  createDiagnosisAction,
  createLabTestAction,
  createMedicalRecordAction,
  createVitalSignsAction,
  updateDiagnosisAction,
  updateLabTestAction,
  updateVitalSignsAction
} from '../../../../apps/web/src/actions/medical.action';
import {
  getCachedActivePrescriptionsByPatient,
  getCachedDiagnosesByAppointment,
  getCachedDiagnosesByDoctor,
  getCachedDiagnosesByMedicalRecord,
  getCachedDiagnosesByPatient,
  getCachedDiagnosisById,
  getCachedLabTestById,
  getCachedLabTestsByMedicalRecord,
  getCachedLabTestsByPatient,
  getCachedLabTestsByService,
  getCachedLatestVitalSignsByPatient,
  getCachedMedicalRecordById,
  getCachedMedicalRecordsByClinic,
  getCachedMedicalRecordsByPatient,
  getCachedMedicalRecordsCount,
  getCachedPrescriptionsByMedicalRecord,
  getCachedVitalSignsById,
  getCachedVitalSignsByMedicalRecord,
  getCachedVitalSignsByPatient
} from '../cache/medical.cache';
export const medicalRouter: AnyRouter = createTRPCRouter({
  // ==================== DIAGNOSIS PROCEDURES ====================

  getDiagnosisById: protectedProcedure.input(DiagnosisByIdSchema).query(async ({ ctx, input }) => {
    return getCachedDiagnosisById(input.id, ctx.clinicId ?? '');
  }),
  getVitalSignsById: protectedProcedure.input(VitalSignsByIdSchema).query(async ({ ctx, input }) => {
    return getCachedVitalSignsById(input.id ?? '', ctx.clinicId ?? '');
  }),

  getVitalSignsByMedicalRecord: protectedProcedure
    .input(VitalSignsByMedicalRecordSchema)
    .query(async ({ ctx, input }) => {
      return getCachedVitalSignsByMedicalRecord(input.medicalId ?? '', ctx.clinicId ?? '');
    }),

  getVitalSignsByPatient: protectedProcedure.input(VitalSignsByPatientSchema).query(async ({ ctx, input }) => {
    return getCachedVitalSignsByPatient(input.patientId, ctx.clinicId ?? '', {
      startDate: input.startDate,
      endDate: input.endDate,
      limit: input.limit
    });
  }),

  getLatestVitalSignsByPatient: protectedProcedure
    .input(z.object({ patientId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return getCachedLatestVitalSignsByPatient(input.patientId, ctx.clinicId ?? '');
    }),

  createVitalSigns: protectedProcedure.input(VitalSignsCreateSchema).mutation(async ({ input }) => {
    return createVitalSignsAction(input);
  }),

  updateVitalSigns: protectedProcedure.input(VitalSignsUpdateSchema).mutation(async ({ input }) => {
    return updateVitalSignsAction(input);
  }),
  getDiagnosesByPatient: protectedProcedure
    .input(
      DiagnosisFilterSchema.pick({
        patientId: true,
        startDate: true,
        endDate: true,
        type: true,
        limit: true
      })
    )
    .query(async ({ ctx, input }) => {
      return getCachedDiagnosesByPatient(input.patientId ?? '', ctx.clinicId ?? '', {
        startDate: input.startDate,
        endDate: input.endDate,
        type: input.type,
        limit: input.limit
      });
    }),
  getDiagnosesByMedicalRecord: protectedProcedure
    .input(DiagnosisByMedicalRecordSchema)
    .query(async ({ ctx, input }) => {
      return getCachedDiagnosesByMedicalRecord(input.medicalId ?? '', ctx.clinicId ?? '');
    }),

  getDiagnosesByAppointment: protectedProcedure.input(DiagnosisByAppointmentSchema).query(async ({ ctx, input }) => {
    return getCachedDiagnosesByAppointment(input.appointmentId ?? '', ctx.clinicId ?? '');
  }),

  getDiagnosesByDoctor: protectedProcedure
    .input(
      z.object({
        doctorId: z.uuid(),
        limit: z.number().min(1).max(100).optional()
      })
    )
    .query(async ({ ctx, input }) => {
      return getCachedDiagnosesByDoctor(input.doctorId, ctx.clinicId ?? '', input.limit);
    }),

  createDiagnosis: protectedProcedure.input(DiagnosisCreateSchema).mutation(async ({ input }) => {
    return createDiagnosisAction(input);
  }),

  updateDiagnosis: protectedProcedure.input(DiagnosisUpdateSchema).mutation(async ({ input }) => {
    return updateDiagnosisAction(input);
  }),

  // ==================== MEDICAL RECORDS PROCEDURES ====================

  getMedicalRecordById: protectedProcedure.input(MedicalRecordByIdSchema).query(async ({ ctx, input }) => {
    return getCachedMedicalRecordById(input.id, ctx.clinicId ?? '');
  }),

  getMedicalRecordsByPatient: protectedProcedure
    .input(
      MedicalRecordFilterSchema.pick({
        patientId: true,
        limit: true,
        offset: true
      })
    )
    .query(async ({ ctx, input }) => {
      return getCachedMedicalRecordsByPatient(input.patientId ?? '', ctx.clinicId ?? '', {
        limit: input.limit,
        offset: input.offset
      });
    }),

  getMedicalRecordsByClinic: protectedProcedure
    .input(
      MedicalRecordFilterSchema.pick({
        search: true,
        page: true,
        limit: true,
        startDate: true,
        endDate: true
      })
    )
    .query(async ({ ctx, input }) => {
      const clinicId = ctx.clinicId ?? '';
      const limit = input.limit || 20;
      const offset = ((input.page || 1) - 1) * limit;

      const [records, total] = await Promise.all([
        getCachedMedicalRecordsByClinic(clinicId, {
          search: input.search,
          limit,
          offset,
          startDate: input.startDate,
          endDate: input.endDate
        }),
        getCachedMedicalRecordsCount(clinicId, input.search)
      ]);

      return {
        data: records,
        total,
        page: input.page || 1,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }),

  createMedicalRecord: protectedProcedure.input(MedicalRecordCreateSchema).mutation(async ({ input }) => {
    return createMedicalRecordAction(input);
  }),

  // ==================== LAB TESTS PROCEDURES ====================

  getLabTestById: protectedProcedure.input(LabTestByIdSchema).query(async ({ ctx, input }) => {
    return getCachedLabTestById(input.id, ctx.clinicId ?? '');
  }),

  getLabTestsByMedicalRecord: protectedProcedure.input(LabTestByMedicalRecordSchema).query(async ({ ctx, input }) => {
    return getCachedLabTestsByMedicalRecord(input.medicalId, ctx.clinicId ?? '');
  }),

  getLabTestsByPatient: protectedProcedure
    .input(
      LabTestFilterSchema.pick({
        patientId: true,
        startDate: true,
        endDate: true,
        status: true,
        limit: true
      })
    )
    .query(async ({ ctx, input }) => {
      return getCachedLabTestsByPatient(input.patientId ?? '', ctx.clinicId ?? '', {
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status,
        limit: input.limit
      });
    }),

  getLabTestsByService: protectedProcedure
    .input(
      LabTestFilterSchema.pick({
        serviceId: true,
        startDate: true,
        endDate: true,
        status: true,
        limit: true
      })
    )
    .query(async ({ ctx, input }) => {
      return getCachedLabTestsByService(input.serviceId ?? '', ctx.clinicId ?? '', {
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status,
        limit: input.limit
      });
    }),

  createLabTest: protectedProcedure.input(LabTestCreateSchema).mutation(async ({ input }) => {
    return createLabTestAction(input);
  }),

  updateLabTest: protectedProcedure.input(LabTestUpdateSchema).mutation(async ({ input }) => {
    return updateLabTestAction(input);
  }),

  // ==================== PRESCRIPTIONS PROCEDURES ====================

  getPrescriptionsByMedicalRecord: protectedProcedure
    .input(
      PrescriptionFilterSchema.pick({
        medicalRecordId: true,
        limit: true
      })
    )
    .query(async ({ ctx, input }) => {
      return getCachedPrescriptionsByMedicalRecord(input.medicalRecordId ?? '', ctx.clinicId ?? '', {
        limit: input.limit
      });
    }),

  getActivePrescriptionsByPatient: protectedProcedure
    .input(z.object({ patientId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return getCachedActivePrescriptionsByPatient(input.patientId, ctx.clinicId ?? '');
    })
});
