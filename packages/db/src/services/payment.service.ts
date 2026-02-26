/**
 * 🔵 PAYMENT SERVICE
 * - Business logic for payments and billing
 * - Orchestrates repository calls
 * - Handles cache invalidation
 */

import { CACHE_KEYS } from '@naroto/redis/cache-keys';

import type { PrismaClient } from '../../generated/client';
import prisma from '../client';
import { NotFoundError } from '../error';
import * as appointmentRepo from '../repositories/appointment.repo';
import * as paymentRepo from '../repositories/payment.repo';
import type { AddNewBillInput, PaymentFilterInput, PaymentInput } from '../zodSchemas';
import { cacheService } from './cache.service';

export class PaymentService {
  private readonly CACHE_ENABLED = process.env.CACHE_ENABLED === 'true';

  constructor(private readonly db: typeof prisma = prisma) {}

  /**
   * Get paginated payments with filters
   */
  async getPayments(filter: PaymentFilterInput) {
    const { clinicId, search, skip, take } = filter;

    const [data, total] = await paymentRepo.findPaymentsPaginated(this.db, {
      clinicId,
      search,
      skip,
      take
    });

    return { data, total };
  }

  /**
   * Add a bill item to an existing payment or create new payment
   */
  async addBillItem(input: AddNewBillInput) {
    return this.db.$transaction(async tx => {
      // Find or create payment
      let paymentId = input.billId;

      if (!paymentId) {
        // Find appointment to get patient ID
        const appointment = await appointmentRepo.findAppointmentById(
          tx as unknown as PrismaClient,
          input.appointmentId,
          input.clinicId
        );

        if (!appointment) {
          throw new NotFoundError('Appointment', input.appointmentId);
        }

        // Check for existing payment
        const existingPayments = await paymentRepo.findPaymentsByAppointment(
          tx as unknown as PrismaClient,
          input.appointmentId
        );

        if (existingPayments.length > 0) {
          paymentId = existingPayments[0]?.id ?? '';
        } else {
          // Create new payment
          const newPayment = await paymentRepo.createPayment(tx as unknown as PrismaClient, {
            id: crypto.randomUUID(),
            appointmentId: input.appointmentId,
            patientId: appointment.patientId,
            clinicId: input.clinicId,
            billDate: new Date(),
            paymentDate: new Date(),
            discount: 0,
            amountPaid: 0,
            totalAmount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          paymentId = newPayment.id;
        }
      }

      // Add bill item
      const billItem = await paymentRepo.createBillItem(tx as unknown as PrismaClient, {
        id: crypto.randomUUID(),
        billId: paymentId,
        serviceId: input.serviceId,
        serviceDate: new Date(input.serviceDate),
        quantity: Number(input.quantity),
        unitCost: Number(input.unitCost),
        totalCost: Number(input.totalCost),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Invalidate caches
      if (this.CACHE_ENABLED) {
        await cacheService.invalidate(CACHE_KEYS.PAYMENT(paymentId), CACHE_KEYS.PAYMENTS_CLINIC(input.clinicId));
      }

      return billItem;
    });
  }

  /**
   * Generate final bill (complete payment)
   */
  async generateBill(input: PaymentInput, clinicId: string) {
    return this.db.$transaction(async tx => {
      // Calculate discount amount
      const discountAmount = (Number(input.discount) / 100) * Number(input.totalAmount);

      // Update payment
      const payment = await paymentRepo.updatePayment(tx as unknown as PrismaClient, input.id, {
        billDate: input.billDate,
        discount: discountAmount,
        totalAmount: Number(input.totalAmount),
        updatedAt: new Date()
      });

      // Update appointment status to COMPLETED
      await appointmentRepo.updateAppointmentStatus(
        tx as unknown as PrismaClient,
        payment.appointmentId,
        clinicId,
        'COMPLETED'
      );

      // Invalidate caches
      if (this.CACHE_ENABLED) {
        await cacheService.invalidate(
          CACHE_KEYS.PAYMENT(input.id),
          CACHE_KEYS.PAYMENTS_CLINIC(input.id),
          CACHE_KEYS.APPOINTMENT(payment.appointmentId)
        );
      }

      return payment;
    });
  }
}

export const paymentService = new PaymentService();
export default PaymentService;
