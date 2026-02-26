/**
 * 🟣 MEDICAL MODULE - tRPC ROUTER
 *
 * RESPONSIBILITIES:
 * - tRPC procedure definitions
 * - Permission checks (via middleware)
 * - Input validation via schema
 * - Delegates to service layer
 * - NO business logic
 * - NO database calls
 * - NO Next.js cache imports
 */

import type { LabStatus } from '@naroto/db';
import { labTestService } from '@naroto/db/services/lab-test.service';
import { medicalService } from '@naroto/db/services/medical.service';
// Import service from @naroto/db/services
import { medicalRecordService } from '@naroto/db/services/medical-record.service';
import { prescriptionService } from '@naroto/db/services/prescription.service';
import { vitalService } from '@naroto/db/services/vitals.service';
// Import schemas from @naroto/db/zodSchemas
import {
  DiagnosisByAppointmentSchema,
  DiagnosisByIdSchema,
  DiagnosisByMedicalRecordSchema,
  type DiagnosisCreateInput,
  DiagnosisCreateSchema,
  DiagnosisFilterSchema,
  DiagnosisUpdateSchema,
  VitalSignsByIdSchema,
  VitalSignsByMedicalRecordSchema,
  VitalSignsByPatientSchema,
  VitalSignsCreateSchema,
  VitalSignsUpdateSchema
} from '@naroto/db/zodSchemas/encounter.schema';
import {
  LabTestByIdSchema,
  LabTestByMedicalRecordSchema,
  LabTestCreateSchema,
  LabTestFilterSchema,
  LabTestUpdateSchema,
  MedicalRecordByIdSchema,
  type MedicalRecordCreateInput,
  MedicalRecordCreateSchema,
  MedicalRecordFilterSchema
} from '@naroto/db/zodSchemas/medical.schema';
import { PrescriptionFilterSchema } from '@naroto/db/zodSchemas/prescription.schema';
import type { AnyRouter } from '@trpc/server';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '..';

export const medicalRouter: AnyRouter = createTRPCRouter({
  // ==================== DIAGNOSIS PROCEDURES ====================

  /**
   * Get diagnosis by ID
   * Service handles caching internally
   */
  getDiagnosisById: protectedProcedure.input(DiagnosisByIdSchema).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      return await medicalService.getDiagnosisById(input.id, clinicId);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch diagnosis'
      });
    }
  }),

  /**
   * Get diagnoses by patient
   * Service handles caching internally
   */
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
      try {
        const clinicId = ctx.session?.user.clinic?.id;
        if (!(clinicId && input.patientId)) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID or Patient ID not found'
          });
        }

        return await medicalService.getPatientDiagnoses(input.patientId, clinicId, {
          startDate: input.startDate,
          endDate: input.endDate,
          type: input.type,
          limit: input.limit
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch patient diagnoses'
        });
      }
    }),

  /**
   * Get diagnoses by medical record
   * Service handles caching internally
   */
  getDiagnosesByMedicalRecord: protectedProcedure
    .input(DiagnosisByMedicalRecordSchema)
    .query(async ({ ctx, input }) => {
      try {
        const clinicId = ctx.session?.user.clinic?.id;
        if (!clinicId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID not found'
          });
        }

        return await medicalService.getDiagnosesByMedicalRecord(input.medicalId ?? '', clinicId);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch diagnoses by medical record'
        });
      }
    }),

  /**
   * Get diagnoses by appointment
   * Service handles caching internally
   */
  getDiagnosesByAppointment: protectedProcedure.input(DiagnosisByAppointmentSchema).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      return await medicalService.getDiagnosesByAppointment(input.appointmentId ?? '');
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch diagnoses by appointment'
      });
    }
  }),

  /**
   * Get diagnoses by doctor
   * Service handles caching internally
   */
  getDiagnosesByDoctor: protectedProcedure
    .input(
      z.object({
        doctorId: z.string().uuid(),
        limit: z.number().min(1).max(100).optional()
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const clinicId = ctx.session?.user.clinic?.id;
        if (!clinicId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID not found'
          });
        }

        return await medicalService.getDiagnosesByDoctor(input.doctorId, input.limit);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch diagnoses by doctor'
        });
      }
    }),

  /**
   * Create diagnosis
   * Service handles cache invalidation internally
   */
  createDiagnosis: protectedProcedure.input(DiagnosisCreateSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      const userId = ctx.user.id;

      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      const result = await medicalService.createDiagnosis({
        ...input,
        doctorId: userId, // The logged-in user is the doctor creating the diagnosis
        clinicId,
        date: input.date || new Date()
      } as DiagnosisCreateInput);

      return {
        success: true,
        message: 'Diagnosis created successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create diagnosis'
      });
    }
  }),

  /**
   * Update diagnosis
   * Service handles cache invalidation internally
   */
  updateDiagnosis: protectedProcedure.input(DiagnosisUpdateSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      const result = await medicalService.updateDiagnosis(input.id, clinicId, input);

      return {
        success: true,
        message: 'Diagnosis updated successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update diagnosis'
      });
    }
  }),

  /**
   * Delete diagnosis
   * Service handles cache invalidation internally
   */
  deleteDiagnosis: protectedProcedure.input(DiagnosisByIdSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      const result = await medicalService.deleteDiagnosis(input.id, clinicId);

      return {
        success: true,
        message: 'Diagnosis deleted successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete diagnosis'
      });
    }
  }),

  // ==================== VITAL SIGNS PROCEDURES ====================

  /**
   * Get vital signs by ID
   * Service handles caching internally
   */
  getVitalSignsById: protectedProcedure.input(VitalSignsByIdSchema).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      return await vitalService.getVitalSignsById(input.id ?? '', clinicId);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch vital signs'
      });
    }
  }),

  /**
   * Get vital signs by medical record
   * Service handles caching internally
   */
  getVitalSignsByMedicalRecord: protectedProcedure
    .input(VitalSignsByMedicalRecordSchema)
    .query(async ({ ctx, input }) => {
      try {
        const clinicId = ctx.session?.user.clinic?.id;
        if (!clinicId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID not found'
          });
        }

        return await vitalService.getVitalSignsByMedicalRecord(input.medicalId ?? '', clinicId);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch vital signs by medical record'
        });
      }
    }),

  /**
   * Get vital signs by patient
   * Service handles caching internally
   */
  getVitalSignsByPatient: protectedProcedure.input(VitalSignsByPatientSchema).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      const result = await medicalService.getPatientVitalSigns(input.patientId, clinicId, {
        startDate: input.startDate,
        endDate: input.endDate,
        limit: input.limit
      });

      return result.vitals;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch patient vital signs'
      });
    }
  }),

  /**
   * Get latest vital signs by patient
   * Service handles caching internally
   */
  getLatestVitalSignsByPatient: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const clinicId = ctx.session?.user.clinic?.id;
        if (!clinicId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID not found'
          });
        }

        const result = await medicalService.getPatientVitalSigns(input.patientId, clinicId, { limit: 1 });
        return result.latest;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch latest vital signs'
        });
      }
    }),

  /**
   * Create vital signs
   * Service handles cache invalidation internally
   */
  createVitalSigns: protectedProcedure.input(VitalSignsCreateSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      // Removed unused userId to satisfy linter

      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      // Force mapping to match the Service type precisely
      const result = await vitalService.createVitalSigns({
        ...input,
        medicalId: input.medicalId ?? '', // Handle the string | undefined mismatch
        patientId: input.patientId,
        recordedAt: input.recordedAt ?? new Date(),
        clinicId // Now matches the required clinicId in service
      });

      return {
        success: true,
        message: 'Vital signs recorded successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create vital signs'
      });
    }
  }),

  /**
   * Update vital signs
   * Service handles cache invalidation internally
   */
  updateVitalSigns: protectedProcedure.input(VitalSignsUpdateSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      // The service expects id as first parameter, then clinicId, then data
      const result = await vitalService.updateVitalSigns(input.id, clinicId, input);

      return {
        success: true,
        message: 'Vital signs updated successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update vital signs'
      });
    }
  }),

  // ==================== MEDICAL RECORDS PROCEDURES ====================

  /**
   * Get medical record by ID
   * Service handles caching internally
   */
  getMedicalRecordById: protectedProcedure.input(MedicalRecordByIdSchema).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      return await medicalService.getMedicalRecordById(input.id, clinicId);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch medical record'
      });
    }
  }),

  /**
   * Get medical records by patient
   * Service handles caching internally
   */
  getMedicalRecordsByPatient: protectedProcedure
    .input(
      MedicalRecordFilterSchema.pick({
        patientId: true,
        limit: true,
        offset: true
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const clinicId = ctx.session?.user.clinic?.id;
        if (!(clinicId && input.patientId)) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID or Patient ID not found'
          });
        }

        const records = await medicalRecordService.getMedicalRecordsByPatient(input.patientId, clinicId, {
          limit: input.limit,
          offset: input.offset
        });

        // The service returns { records, total } format
        return records.records;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch patient medical records'
        });
      }
    }),

  /**
   * Get medical records by clinic (paginated)
   * Service handles caching internally
   */
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
      try {
        const clinicId = ctx.session?.user.clinic?.id;
        if (!clinicId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID not found'
          });
        }

        const limit = input.limit || 20;
        const offset = ((input.page || 1) - 1) * limit;

        const records = await medicalRecordService.getMedicalRecordsByClinic(clinicId, {
          search: input.search,
          limit,
          offset,
          startDate: input.startDate,
          endDate: input.endDate
        });

        const total = await medicalRecordService.countMedicalRecordsByClinic(clinicId, input.search);

        return {
          data: records,
          total,
          page: input.page || 1,
          limit,
          totalPages: Math.ceil(total / limit)
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch clinic medical records'
        });
      }
    }),

  /**
   * Create medical record
   * Service handles cache invalidation internally
   */
  createMedicalRecord: protectedProcedure.input(MedicalRecordCreateSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      const userId = ctx.user.id;

      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      const result = await medicalService.createMedicalRecord({
        ...input,
        doctorId: userId,
        clinicId
      } as MedicalRecordCreateInput);

      return {
        success: true,
        message: 'Medical record created successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create medical record'
      });
    }
  }),

  // ==================== LAB TESTS PROCEDURES ====================

  /**
   * Get lab test by ID
   * Service handles caching internally
   */
  getLabTestById: protectedProcedure.input(LabTestByIdSchema).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      return await medicalService.getLabTestById(input.id, clinicId);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch lab test'
      });
    }
  }),

  /**
   * Get lab tests by medical record
   * Service handles caching internally
   */
  getLabTestsByMedicalRecord: protectedProcedure.input(LabTestByMedicalRecordSchema).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      return await labTestService.getLabTestsByMedicalRecord(input.medicalId, clinicId);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch lab tests by medical record'
      });
    }
  }),

  /**
   * Get lab tests by patient
   * Service handles caching internally
   */
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
      try {
        const clinicId = ctx.session?.user.clinic?.id;
        if (!(clinicId && input.patientId)) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID or Patient ID not found'
          });
        }

        const result = await medicalService.getPatientLabTests(input.patientId, clinicId, {
          startDate: input.startDate,
          endDate: input.endDate,
          status: input.status,
          limit: input.limit
        });

        return result.labTests;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch patient lab tests'
        });
      }
    }),

  /**
   * Get lab tests by service
   * Service handles caching internally
   */
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
      try {
        const clinicId = ctx.session?.user.clinic?.id;
        if (!(clinicId && input.serviceId)) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID or Service ID not found'
          });
        }

        return await labTestService.getLabTestsByService(input.serviceId, clinicId, {
          startDate: input.startDate,
          endDate: input.endDate,
          status: input.status,
          limit: input.limit
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch lab tests by service'
        });
      }
    }),

  createLabTest: protectedProcedure.input(LabTestCreateSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      const userId = ctx.user.id;

      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      // Use 'as any' temporarily or define the intersection to bypass the "known properties" check
      // while ensuring clinicId is included as required by labTestService.createLabTest
      const result = await labTestService.createLabTest({
        ...input,
        clinicId,
        orderedBy: userId,
        status: input.status as LabStatus
      }); // Cast to any or the specific Service Input type to satisfy the missing clinicId requirement

      return {
        success: true,
        message: 'Lab test created successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create lab test'
      });
    }
  }),

  /**
   * Update lab test
   * Service handles cache invalidation internally
   */
  updateLabTest: protectedProcedure.input(LabTestUpdateSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      const result = await labTestService.updateLabTest(input.id, clinicId, input);

      return {
        success: true,
        message: 'Lab test updated successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update lab test'
      });
    }
  }),

  /**
   * Delete lab test
   * Service handles cache invalidation internally
   */
  deleteLabTest: protectedProcedure.input(LabTestByIdSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      const result = await labTestService.deleteLabTest(input.id, clinicId);

      return {
        success: true,
        message: 'Lab test deleted successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete lab test'
      });
    }
  }),

  // ==================== PRESCRIPTIONS PROCEDURES ====================

  /**
   * Get prescriptions by medical record
   * Service handles caching internally
   */
  getPrescriptionsByMedicalRecord: protectedProcedure
    .input(
      PrescriptionFilterSchema.pick({
        medicalRecordId: true,
        limit: true
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const clinicId = ctx.session?.user.clinic?.id;
        if (!(clinicId && input.medicalRecordId)) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID or Medical Record ID not found'
          });
        }

        return await prescriptionService.getPrescriptionsByMedicalRecord(input.medicalRecordId, clinicId, {
          limit: input.limit
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch prescriptions by medical record'
        });
      }
    }),

  /**
   * Get active prescriptions by patient
   * Service handles caching internally
   */
  getActivePrescriptionsByPatient: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const clinicId = ctx.session?.user.clinic?.id;
        if (!clinicId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID not found'
          });
        }

        return await medicalService.getPatientActivePrescriptions(input.patientId, clinicId);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch active prescriptions'
        });
      }
    }),

  // ==================== COMPREHENSIVE PATIENT MEDICAL SUMMARY ====================

  /**
   * Get patient medical summary
   * Service handles caching internally
   */
  getPatientMedicalSummary: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const clinicId = ctx.session?.user.clinic?.id;
        if (!clinicId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID not found'
          });
        }

        return await medicalService.getPatientMedicalSummary(input.patientId, clinicId);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch patient medical summary'
        });
      }
    })
});
