/**
 * 🟣 PAYMENTS MODULE - tRPC ROUTER
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

// Import services from @naroto/db/services
import { medicalService, paymentService } from '@naroto/db/services/index';

// Import schemas from @naroto/db/zodSchemas

import {
  type AddNewBillInput,
  AddNewBillInputSchema,
  DiagnosisCreateSchema,
  type PaymentFilterInput,
  type PaymentInput,
  PaymentSchema
} from '@naroto/db/zodSchemas/index';
import type { AnyRouter } from '@trpc/server';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { adminProcedure, createTRPCRouter, protectedProcedure } from '..';

// Extended schema for diagnosis with appointment
const AddDiagnosisInputSchema = DiagnosisCreateSchema.extend({
  appointmentId: z.string().uuid()
});

export const paymentsRouter: AnyRouter = createTRPCRouter({
  /**
   * Get paginated payment records
   * Service handles caching internally
   */
  getPaymentRecords: adminProcedure
    .input(
      z.object({
        page: z.union([z.number(), z.string()]),
        limit: z.union([z.number(), z.string()]).optional(),
        search: z.string().optional()
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

        const PAGE_NUMBER = Number(input.page) <= 0 ? 1 : Number(input.page);
        const LIMIT = Number(input.limit) || 10;
        const SKIP = (PAGE_NUMBER - 1) * LIMIT;

        const filter: PaymentFilterInput = {
          clinicId,
          search: input.search,
          skip: SKIP,
          take: LIMIT
        };

        const result = await paymentService.getPayments(filter);

        return {
          data: result.data,
          totalRecords: result.total,
          totalPages: Math.ceil(result.total / LIMIT),
          currentPage: PAGE_NUMBER
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to retrieve payment records'
        });
      }
    }),

  /**
   * Add diagnosis to an appointment
   * Service handles business logic and database operations
   */
  addDiagnosis: protectedProcedure.input(AddDiagnosisInputSchema).mutation(async ({ input, ctx }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      const _userId = ctx.user.id;

      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      // 1. Map input to match Prisma Model field names
      // Ensure medicalId is passed correctly as it is required & unique
      const result = await medicalService.createDiagnosis({
        patientId: input.patientId,
        doctorId: input.doctorId,
        clinicId,
        appointmentId: input.appointmentId,
        date: input.date ?? new Date(),

        // Model field names
        symptoms: input.symptoms,
        diagnosis: input.diagnosis,
        treatment: input.treatment,
        notes: input.notes,
        prescribedMedications: input.prescribedMedications ?? '',
        followUpPlan: input.followUpPlan,

        // Enums mapping
        status: input.status,
        type: input.type // Map string type if used separately
      });

      return {
        success: true,
        message: 'Diagnosis added successfully',
        data: result
      };
    } catch (error) {
      console.error('AddDiagnosis Error:', error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to add diagnosis'
      });
    }
  }),
  /**
   * Add a new bill line item to an existing payment
   * Service handles business logic and database operations
   */
  addNewBill: protectedProcedure.input(AddNewBillInputSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      const result = await paymentService.addBillItem(input as unknown as AddNewBillInput);

      return {
        success: true,
        message: 'Bill item added successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to add bill item'
      });
    }
  }),

  /**
   * Generate final bill (complete payment)
   * Service handles business logic and database operations
   */
  generateBill: protectedProcedure.input(PaymentSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      const result = await paymentService.generateBill(input as PaymentInput, clinicId);

      return {
        success: true,
        message: 'Bill generated successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to generate bill'
      });
    }
  })
});
