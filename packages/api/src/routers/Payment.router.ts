import prisma from '@naroto/db';
import type { Payment, Prisma } from '@naroto/db/browser';
import { AddNewBillInputSchema, DiagnosisSchema, PaymentSchema } from '@naroto/db/zodSchemas/index';
import type { AnyRouter } from '@trpc/server';
import { TRPCError } from '@trpc/server';
import z from 'zod';

import { adminProcedure, createTRPCRouter, protectedProcedure } from '..';

const AddDiagnosisInputSchema = DiagnosisSchema.extend({
  appointmentId: z.string() // string id of appointment
});

export const paymentsRouter: AnyRouter = createTRPCRouter({
  getPaymentRecords: adminProcedure
    .input(
      z.object({
        page: z.union([z.number(), z.string()]),
        limit: z.union([z.number(), z.string()]).optional(),
        search: z.string().optional()
      })
    )
    .query(async ({ input }) => {
      try {
        const PAGE_NUMBER = Number(input.page) <= 0 ? 1 : Number(input.page);
        const LIMIT = Number(input.limit) || 10;
        const SKIP = (PAGE_NUMBER - 1) * LIMIT;
        const search = input.search || '';

        const where: Prisma.PaymentWhereInput = {
          OR: [
            {
              patient: {
                firstName: { contains: search, mode: 'insensitive' }
              }
            },
            {
              patient: {
                lastName: { contains: search, mode: 'insensitive' }
              }
            },
            { patientId: { contains: search, mode: 'insensitive' } }
          ]
        };

        const [data, totalRecords] = await Promise.all([
          prisma.payment.findMany({
            where,
            include: {
              patient: {
                select: {
                  firstName: true,
                  lastName: true,
                  dateOfBirth: true,
                  image: true,
                  colorCode: true,
                  gender: true
                }
              }
            },
            skip: SKIP,
            take: LIMIT,
            orderBy: { createdAt: 'desc' }
          }),
          prisma.payment.count({ where })
        ]);

        const totalPages = Math.ceil(totalRecords / LIMIT);

        return {
          data,
          totalRecords,
          totalPages,
          currentPage: PAGE_NUMBER
        };
      } catch (error) {
        console.error(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve payment records.'
        });
      }
    }),

  addDiagnosis: protectedProcedure.input(AddDiagnosisInputSchema).mutation(async ({ input, ctx }) => {
    const { appointmentId, ...validatedData } = input;
    let medicalRecord = null;
    const clinicId = ctx.clinicId ?? '';
    if (!validatedData.medicalId) {
      medicalRecord = await prisma.medicalRecords.create({
        data: {
          patientId: validatedData.patientId,
          doctorId: validatedData.doctorId,
          appointmentId,
          clinicId
        }
      });
    }

    const medId = validatedData.medicalId || medicalRecord?.id;
    if (typeof medId !== 'string') {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Medical Record ID is invalid or missing.'
      });
    }

    await prisma.diagnosis.create({
      data: {
        medicalId: input.medicalId,
        patientId: input.patientId,
        doctorId: input.doctorId,
        symptoms: input.symptoms,
        diagnosis: input.diagnosis,
        // Fix: Explicitly convert undefined to null
        notes: input.notes ?? null,
        prescribedMedications: input.prescribedMedications ?? null,
        followUpPlan: input.followUpPlan ?? null
      }
    });

    return {
      success: true,
      message: 'Bill added successfully'
    };
  }),

  addNewBill: protectedProcedure.input(AddNewBillInputSchema).mutation(async ({ input }) => {
    let billInfo: Payment | null | undefined = null;

    // If no billId is provided, find or create one
    if (input.billId === undefined || input.billId === null) {
      const info = await prisma.appointment.findUnique({
        where: { id: input.appointmentId },
        select: {
          id: true,
          patientId: true,
          bills: true
        }
      });

      if (!info?.patientId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Appointment or patient not found for billing.'
        });
      }

      if (info.bills.length === 0) {
        billInfo = await prisma.payment.create({
          data: {
            appointmentId: info.id,
            patientId: info.patientId,
            billDate: new Date(),
            paymentDate: new Date(),
            discount: 0.0,
            amountPaid: 0.0,
            totalAmount: 0.0
          }
        });
      } else {
        billInfo = info.bills[0];
      }
    } else {
      // If a billId is provided, find the existing bill
      billInfo = await prisma.payment.findUnique({
        where: { id: input.billId }
      });
    }

    if (!billInfo) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Existing bill not found with provided ID.'
      });
    }

    await prisma.patientBill.create({
      data: {
        billId: billInfo.id,
        serviceId: input.serviceId,
        serviceDate: new Date(input.serviceDate),
        quantity: Number(input.quantity),
        unitCost: Number(input.unitCost),
        totalCost: Number(input.totalCost)
      }
    });

    return {
      success: true,
      message: 'Bill added successfully'
    };
  }),

  generateBill: protectedProcedure.input(PaymentSchema).mutation(async ({ input }) => {
    const discountAmount = (Number(input.discount) / 100) * Number(input.totalAmount);

    const res = await prisma.payment.update({
      data: {
        billDate: input.billDate,
        discount: discountAmount,
        totalAmount: Number(input.totalAmount)
      },
      where: { id: input.id }
    });

    await prisma.appointment.update({
      data: {
        status: 'COMPLETED'
      },
      where: { id: res.appointmentId }
    });

    return { message: 'Bill generated successfully' };
  })
});
