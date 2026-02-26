/**
 * 🔵 GROWTH SERVICE
 * - Business logic coordination
 * - Z-score calculations using LMS method
 * - Percentile computations
 * - Caching with versioning
 * - Transaction integrity
 * - Comprehensive error handling
 */

import { logger } from '@naroto/logger';
import { CACHE_KEYS, CACHE_TTL } from '@naroto/redis/cache-keys';
import { jStat } from 'jstat';

import type { Gender, GrowthRecord, GrowthStatus, Prisma, PrismaClient } from '../../../generated/client';
import { db } from '../../client';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../error';
import * as growthRepo from '../../repositories/growth.repo';
import * as patientRepo from '../../repositories/patient.repo';
import { toNumber } from '../../utils';
import { cacheService } from '../cache.service';

// ==================== INTERFACES & TYPES ====================

export interface MeasurementInput {
  date: Date;
  headCircumference?: number | null;
  height?: number | null;
  notes?: string | null;
  patientId: string;
  weight: number;
}

export interface GrowthAssessment {
  bmi?: {
    value: number;
    zScore: number;
    percentile: number;
    status: string;
  };
  heightForAge: {
    zScore: number;
    percentile: number;
    status: GrowthStatus;
  } | null;
  velocity?: GrowthVelocity;
  weightForAge: {
    zScore: number;
    percentile: number;
    status: GrowthStatus;
  } | null;
}

export interface GrowthVelocity {
  height?: {
    value: number;
    unit: 'cm/month';
    percentile?: number;
    status: 'normal' | 'slow' | 'rapid';
  };
  period: {
    from: Date;
    to: Date;
    days: number;
  };
  weight: {
    value: number;
    unit: 'kg/month' | 'g/day';
    percentile?: number;
    status: 'normal' | 'slow' | 'rapid';
  };
}

export interface PreparedGrowthData {
  ageDays: number;
  ageMonths: number;
  bmi: number | null;
  bmiZ: number | null;
  growthStatus: GrowthStatus;
  heightForAgeZ: number | null;
  weightForAgeZ: number | null;
}

export interface LMS {
  L: number;
  M: number;
  S: number;
}

export interface GrowthTrend {
  height: {
    gain: number;
    gainPerDay: number;
  } | null;
  period: {
    from: Date;
    to: Date;
    days: number;
  };
  weight: {
    gain: number;
    gainPerDay: number;
  };
}

// ==================== SERVICE CLASS ====================

export class GrowthService {
  private readonly db: PrismaClient;
  private readonly WHO_LMS_CACHE = new Map<string, LMS>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(prismaClient?: PrismaClient) {
    this.db = prismaClient || db;
  }

  // ==================== PUBLIC METHODS ====================

  /**
   * Get a single measurement by ID
   */
  async getMeasurementById(id: string, clinicId?: string) {
    const cacheKey = CACHE_KEYS.GROWTH_RECORD(id);

    try {
      // Try cache
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached;

      // Query database
      const measurement = await growthRepo.findMeasurementById(this.db, id);

      // Verify clinic access
      if (clinicId && measurement?.patient?.clinicId !== clinicId) {
        return null;
      }

      // Cache result
      if (measurement) {
        await cacheService.set(cacheKey, measurement, CACHE_TTL.GROWTH_RECORD);
      }

      return measurement;
    } catch (error) {
      logger.error('Failed to get growth record', { error, id });
      throw new AppError('Failed to retrieve growth record', {
        code: 'GROWTH_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get patient measurements with pagination
   */
  async getPatientMeasurements(
    patientId: string,
    clinicId: string,
    options?: {
      limit?: number;
      offset?: number;
      fromDate?: Date;
      toDate?: Date;
    }
  ) {
    const cacheKey = CACHE_KEYS.PATIENT_GROWTH(patientId);
    const clinicVersion = await cacheService.getClinicVersion(clinicId);
    const versionedKey = cacheService.buildVersionedKey(cacheKey, clinicVersion);

    try {
      // Verify patient exists
      const patient = await patientRepo.getPatientById(this.db, patientId, clinicId);
      if (!patient || patient.clinicId !== clinicId) {
        throw new NotFoundError('Patient', patientId);
      }

      // Try cache
      const cached = await cacheService.get(versionedKey);
      if (cached) return cached;

      // Query database
      const measurements = await growthRepo.findMeasurementsByPatient(this.db, patientId, {
        limit: options?.limit,
        offset: options?.offset,
        fromDate: options?.fromDate,
        toDate: options?.toDate
      });

      const total = await growthRepo.countMeasurementsByPatient(this.db, patientId);

      // Calculate growth trend
      const growthTrend = measurements.length >= 2 ? this.calculateGrowthTrend(measurements) : null;

      const result = {
        measurements,
        total,
        growthTrend,
        patient: {
          id: patient.id,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender
        }
      };

      // Cache result
      await cacheService.set(versionedKey, result, CACHE_TTL.PATIENT_GROWTH);

      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get patient measurements', { error, patientId });
      throw new AppError('Failed to retrieve patient measurements', {
        code: 'GROWTH_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Record a single measurement with Z-score calculation
   */
  async recordMeasurement(input: MeasurementInput, clinicId: string, recordedById?: string) {
    // Start transaction
    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // Verify patient exists
          const patient = await patientRepo.getPatientById(tx as unknown as PrismaClient, input.patientId, clinicId);

          if (!patient || patient.clinicId !== clinicId) {
            throw new NotFoundError('Patient', input.patientId);
          }
          if (!patient.dateOfBirth) {
            throw new ValidationError('Patient missing date of birth');
          }

          // Check for duplicate measurement on the same day
          const duplicate = await growthRepo.checkDuplicateMeasurement(
            tx as unknown as PrismaClient,
            input.patientId,
            input.date
          );

          if (duplicate) {
            throw new ConflictError('Measurement already exists for this date');
          }

          // Prepare growth data (centralized calculation)
          const growthData = await this.prepareGrowthData(input, patient);

          // Create measurement
          const measurement = await growthRepo.createMeasurement(tx as unknown as PrismaClient, {
            patientId: input.patientId,
            date: input.date,
            weight: input.weight,
            height: input.height ?? 0,
            notes: input.notes || null,
            ageDays: growthData.ageDays,
            ageMonths: growthData.ageMonths,
            weightForAgeZ: growthData.weightForAgeZ,
            heightForAgeZ: growthData.heightForAgeZ,
            growthStatus: growthData.growthStatus,
            recordedById: recordedById || '',
            recordedAt: new Date()
          });

          logger.info('Growth measurement recorded', {
            measurementId: measurement.id,
            patientId: input.patientId,
            growthStatus: growthData.growthStatus
          });

          return measurement;
        } catch (error) {
          logger.error('Failed to record measurement', { error, input });
          throw error; // Transaction will rollback
        }
      })
      .then(async measurement => {
        // AFTER transaction succeeds, invalidate caches
        await cacheService.invalidatePatientCaches(input.patientId, clinicId);
        await cacheService.invalidateClinicCaches(clinicId);
        return measurement;
      });
  }

  /**
   * Record multiple measurements in bulk
   */
  async recordBulkMeasurements(measurements: MeasurementInput[], clinicId: string, recordedById?: string) {
    // Start transaction
    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        const results = [];
        const errors = [];

        for (const input of measurements) {
          try {
            // Verify patient
            const patient = await patientRepo.getPatientById(tx as unknown as PrismaClient, input.patientId, clinicId);

            if (!patient || patient.clinicId !== clinicId) {
              errors.push({ input, error: 'Patient not found' });
              continue;
            }
            if (!patient.dateOfBirth) {
              errors.push({ input, error: 'Patient missing date of birth' });
              continue;
            }

            // Prepare growth data
            const growthData = await this.prepareGrowthData(input, patient);

            // Create measurement
            const measurement = await growthRepo.createMeasurement(tx as unknown as PrismaClient, {
              patientId: input.patientId,
              date: input.date,
              weight: input.weight,
              height: input.height || 0,
              headCircumference: input.headCircumference || 0,
              notes: input.notes || null,
              ageDays: growthData.ageDays,
              ageMonths: growthData.ageMonths,
              weightForAgeZ: growthData.weightForAgeZ,
              heightForAgeZ: growthData.heightForAgeZ,
              growthStatus: growthData.growthStatus,
              recordedById: recordedById || '',
              recordedAt: new Date()
            });

            results.push(measurement);
          } catch (error) {
            errors.push({
              input,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        logger.info('Bulk measurements processed', {
          successCount: results.length,
          errorCount: errors.length
        });

        return { results, errors };
      })
      .then(async result => {
        // AFTER transaction succeeds, invalidate caches for all affected patients
        if (result.results.length > 0) {
          const patientIds = [...new Set(measurements.map(m => m.patientId))];
          await Promise.all([
            ...patientIds.map(id => cacheService.invalidatePatientCaches(id, clinicId)),
            cacheService.invalidateClinicCaches(clinicId)
          ]);
        }
        return result;
      });
  }

  /**
   * Update a measurement
   */
  async updateMeasurement(
    id: string,
    clinicId: string,
    data: Partial<{
      weight: number;
      height: number;
      headCircumference: number;
      notes: string;
    }>
  ) {
    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        // Verify measurement exists
        const measurement = await growthRepo.findMeasurementById(tx as unknown as PrismaClient, id);

        if (!measurement || measurement.patient?.clinicId !== clinicId) {
          throw new NotFoundError('Measurement', id);
        }

        const patient = measurement.patient;
        const updateData: Record<string, unknown> = {
          ...data,
          updatedAt: new Date()
        };

        // If weight or height changed, recalculate Z-scores
        if (data.weight !== undefined || data.height !== undefined) {
          const input: MeasurementInput = {
            patientId: measurement.patientId,
            date: measurement.date,
            weight: data.weight ?? measurement.weight ?? 0,
            height: data.height ?? measurement.height,
            headCircumference: toNumber(data.headCircumference) ?? measurement.headCircumference ?? 0,
            notes: data.notes ?? measurement.notes
          };

          const growthData = await this.prepareGrowthData(input, patient);

          updateData.weightForAgeZ = growthData.weightForAgeZ;
          updateData.heightForAgeZ = growthData.heightForAgeZ;
          updateData.bmi = growthData.bmi;
          updateData.bmiZ = growthData.bmiZ;
          updateData.growthStatus = growthData.growthStatus;
          updateData.ageDays = growthData.ageDays;
          updateData.ageMonths = growthData.ageMonths;
        }

        const updated = await growthRepo.updateGrowthRecord(tx as unknown as PrismaClient, id, updateData);

        logger.info('Measurement updated', { measurementId: id });
        return updated;
      })
      .then(async updated => {
        // AFTER transaction succeeds, invalidate caches
        await cacheService.invalidatePatientCaches(updated.patientId, clinicId);
        await cacheService.invalidateClinicCaches(clinicId);
        return updated;
      });
  }

  /**
   * Delete a measurement
   */
  async deleteMeasurement(id: string, clinicId: string, permanent = false) {
    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        // Verify measurement exists
        const measurement = await growthRepo.findMeasurementById(tx as unknown as PrismaClient, id);

        if (!measurement || measurement.patient?.clinicId !== clinicId) {
          throw new NotFoundError('Measurement', id);
        }

        let result;
        if (permanent) {
          result = await growthRepo.deleteGrowthRecord(tx as unknown as PrismaClient, id);
        } else {
          result = await growthRepo.softDeleteGrowthRecord(tx as unknown as PrismaClient, id, {
            deletedAt: new Date()
          });
        }

        logger.info('Measurement deleted', { measurementId: id, permanent });
        return result;
      })
      .then(async result => {
        // AFTER transaction succeeds, invalidate caches
        await cacheService.invalidatePatientCaches(result.patientId, clinicId);
        await cacheService.invalidateClinicCaches(clinicId);
        return result;
      });
  }

  /**
   * Assess patient growth based on latest measurement
   */
  async assessPatientGrowth(patientId: string, clinicId: string): Promise<GrowthAssessment | null> {
    try {
      // Get patient and latest measurement
      const [patient, latestMeasurement, measurementHistory] = await Promise.all([
        patientRepo.getPatientById(this.db, patientId, clinicId),
        growthRepo.findLatestMeasurementByPatient(this.db, patientId),
        growthRepo.findMeasurementsByPatient(this.db, patientId, { limit: 10 })
      ]);

      if (!patient || patient.clinicId !== clinicId) {
        throw new NotFoundError('Patient', patientId);
      }
      if (!patient.dateOfBirth) {
        throw new ValidationError('Patient missing date of birth');
      }
      if (!latestMeasurement) {
        return null; // No measurements yet
      }

      // Build assessment
      const assessment: GrowthAssessment = {
        weightForAge: latestMeasurement.weightForAgeZ
          ? {
              zScore: toNumber(latestMeasurement.weightForAgeZ),
              percentile: this.zScoreToPercentile(toNumber(latestMeasurement.weightForAgeZ)),
              status: latestMeasurement.growthStatus || 'NORMAL'
            }
          : null,
        heightForAge: latestMeasurement.heightForAgeZ
          ? {
              zScore: toNumber(latestMeasurement.heightForAgeZ),
              percentile: this.zScoreToPercentile(toNumber(latestMeasurement.heightForAgeZ)),
              status: latestMeasurement.growthStatus || 'NORMAL'
            }
          : null
      };

      // Add velocity if enough history
      if (measurementHistory.length >= 2) {
        const velocity = this.calculateGrowthVelocity(measurementHistory);
        if (velocity) {
          assessment.velocity = velocity;
        }
      }

      return assessment;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to assess patient growth', { error, patientId });
      throw new AppError('Failed to assess growth', {
        code: 'GROWTH_ASSESSMENT_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get clinic growth statistics
   */
  async getClinicGrowthStats(clinicId: string, dateRange?: { startDate: Date; endDate: Date }) {
    const cacheKey = dateRange
      ? CACHE_KEYS.CLINIC_GROWTH_STATS(clinicId, dateRange.startDate.toISOString(), dateRange.endDate.toISOString())
      : CACHE_KEYS.CLINIC_GROWTH_STATS(clinicId);

    const clinicVersion = await cacheService.getClinicVersion(clinicId);
    const versionedKey = cacheService.buildVersionedKey(cacheKey, clinicVersion);

    try {
      // Try cache
      const cached = await cacheService.get(versionedKey);
      if (cached) return cached;

      // Get stats from repository
      const stats = await growthRepo.getGrowthStatsByClinic(this.db, clinicId, dateRange);

      const result = {
        ...stats,
        dateRange: dateRange || null,
        calculatedAt: new Date()
      };

      // Cache result
      await cacheService.set(versionedKey, result, CACHE_TTL.CLINIC_STATS);

      return result;
    } catch (error) {
      logger.error('Failed to get clinic growth stats', { error, clinicId });
      throw new AppError('Failed to retrieve growth statistics', {
        code: 'STATS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Centralized growth data preparation
   * Used by recordMeasurement, updateMeasurement, and bulk operations
   */
  private async prepareGrowthData(
    input: MeasurementInput,
    patient: {
      dateOfBirth: Date | string;
      gender: Gender;
    }
  ): Promise<PreparedGrowthData> {
    // Calculate age
    const dob = patient.dateOfBirth instanceof Date ? patient.dateOfBirth : new Date(patient.dateOfBirth);
    const ageDays = Math.floor((input.date.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24));
    const ageMonths = ageDays / 30.44; // Use float for precision

    // Get WHO LMS parameters
    const [weightLMS, heightLMS] = await Promise.all([
      this.getLmsParameters(ageMonths, patient.gender as Gender, 'weight'),
      input.height ? this.getLmsParameters(ageMonths, patient.gender as Gender, 'height') : null
    ]);

    // Calculate Z-scores
    const weightForAgeZ = weightLMS ? this.calculateZScore(input.weight, weightLMS) : null;

    const heightForAgeZ = input.height && heightLMS ? this.calculateZScore(input.height, heightLMS) : null;

    // Calculate BMI and BMI Z-score
    let bmi: number | null = null;
    let bmiZ: number | null = null;

    if (input.weight && input.height && input.height > 0) {
      bmi = input.weight / (input.height / 100) ** 2;

      // Get BMI LMS parameters
      const bmiLMS = await this.getLmsParameters(ageMonths, patient.gender as Gender, 'bmi');
      if (bmiLMS) {
        bmiZ = this.calculateZScore(bmi, bmiLMS);
      }
    }

    // Determine growth status
    const growthStatus = this.determineGrowthStatus(weightForAgeZ, heightForAgeZ, bmiZ);

    return {
      ageDays,
      ageMonths,
      weightForAgeZ,
      heightForAgeZ,
      bmi,
      bmiZ,
      growthStatus
    };
  }

  /**
   * Get LMS parameters from WHO standards
   */
  private async getLmsParameters(
    ageMonths: number,
    gender: Gender,
    measurement: 'weight' | 'height' | 'bmi'
  ): Promise<LMS | null> {
    const cacheKey = `lms:${gender}:${measurement}:${Math.floor(ageMonths)}`;

    // Check memory cache first
    const cached = this.WHO_LMS_CACHE.get(cacheKey);
    if (cached) return cached;

    try {
      // Map measurement type to database enum
      let measurementType: 'Weight' | 'Height' | 'HeadCircumference';
      if (measurement === 'weight') measurementType = 'Weight';
      else if (measurement === 'height') measurementType = 'Height';
      else measurementType = 'HeadCircumference';

      // Get from database
      const standard = await growthRepo.findWHOStandardByExactAge(this.db, {
        gender,
        measurementType,
        ageInMonths: Math.round(ageMonths)
      });

      if (standard && standard.lValue !== null && standard.mValue !== null && standard.sValue !== null) {
        const params: LMS = {
          L: standard.lValue,
          M: standard.mValue,
          S: standard.sValue
        };

        // Cache in memory (short-lived)
        this.WHO_LMS_CACHE.set(cacheKey, params);
        setTimeout(() => this.WHO_LMS_CACHE.delete(cacheKey), this.CACHE_TTL_MS);

        return params;
      }

      return null;
    } catch (error) {
      logger.warn('Failed to get LMS parameters', {
        error,
        ageMonths,
        gender,
        measurement
      });
      return null;
    }
  }

  /**
   * Calculate Z-score using LMS method
   */
  private calculateZScore(value: number, lms: LMS): number {
    const { L, M, S } = lms;

    // Handle L ≈ 0 (Box-Cox transformation)
    if (Math.abs(L) < 0.001) {
      return Math.log(value / M) / S;
    }

    // Standard LMS formula
    return ((value / M) ** L - 1) / (L * S);
  }

  /**
   * Convert Z-score to percentile using normal distribution
   */
  private zScoreToPercentile(zScore: number): number {
    return Number((jStat.normal.cdf(zScore, 0, 1) * 100).toFixed(1));
  }

  /**
   * Determine growth status based on Z-scores
   */
  private determineGrowthStatus(weightZ: number | null, heightZ: number | null, bmiZ: number | null): GrowthStatus {
    // Use BMI if available (most accurate)
    if (bmiZ !== null) {
      if (bmiZ < -2) return 'STUNTED';
      if (bmiZ > 3) return 'OBESE';
      if (bmiZ > 2) return 'OVERWEIGHT';
      return 'NORMAL';
    }

    // Fallback to weight-for-age
    if (weightZ !== null) {
      if (weightZ < -2) return 'UNDERWEIGHT';
      if (weightZ > 3) return 'OBESE';
      if (weightZ > 2) return 'OVERWEIGHT';
    }

    // Check for stunting
    if (heightZ !== null && heightZ < -2) {
      return 'STUNTED';
    }

    return 'NORMAL';
  }

  /**
   * Calculate growth trend from measurements
   */
  private calculateGrowthTrend(measurements: GrowthRecord[]): GrowthTrend | null {
    if (measurements.length < 2) return null;

    const sorted = [...measurements].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const first = sorted[0];
    const last = sorted.at(-1);

    const daysDiff =
      (new Date(last?.date ?? new Date()).getTime() - new Date(first?.date ?? new Date()).getTime()) /
      (1000 * 60 * 60 * 24);

    return {
      period: {
        from: first?.date ?? new Date(),
        to: last?.date ?? new Date(),
        days: daysDiff
      },
      weight: {
        gain: (last?.weight ?? 0) - (first?.weight ?? 0),
        gainPerDay: daysDiff > 0 ? ((last?.weight ?? 0) - (first?.weight ?? 0)) / daysDiff : 0
      },
      height:
        last?.height && first?.height
          ? {
              gain: last.height - first.height,
              gainPerDay: daysDiff > 0 ? (last.height - first.height) / daysDiff : 0
            }
          : null
    };
  }

  /**
   * Calculate growth velocity between measurements
   */
  private calculateGrowthVelocity(measurements: GrowthRecord[]): GrowthVelocity | null {
    if (measurements.length < 2) return null;

    const sorted = [...measurements].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const latest = sorted.at(-1);
    const previous = sorted.at(-2);

    if (!(latest && previous)) return null;

    const daysDiff = (new Date(latest.date).getTime() - new Date(previous.date).getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff < 7) return null; // Need at least a week for meaningful velocity

    const weightVelocity = ((latest.weight ?? 0) - (previous.weight ?? 0)) / (daysDiff / 30.44); // kg/month

    // Determine weight velocity status (simplified - would use reference data)
    let weightStatus: 'normal' | 'slow' | 'rapid' = 'normal';
    if (weightVelocity < 0.1) weightStatus = 'slow';
    if (weightVelocity > 0.5) weightStatus = 'rapid';

    const result: GrowthVelocity = {
      weight: {
        value: weightVelocity,
        unit: 'kg/month',
        status: weightStatus
      },
      period: {
        from: previous.date,
        to: latest.date,
        days: daysDiff
      }
    };

    // Add height velocity if available
    if (latest.height && previous.height) {
      const heightVelocity = (latest.height - previous.height) / (daysDiff / 30.44); // cm/month

      let heightStatus: 'normal' | 'slow' | 'rapid' = 'normal';
      if (heightVelocity < 0.3) heightStatus = 'slow';
      if (heightVelocity > 1.5) heightStatus = 'rapid';

      result.height = {
        value: heightVelocity,
        unit: 'cm/month',
        status: heightStatus
      };
    }

    return result;
  }

  /**
   * Invalidate all caches for a patient (public method for external use)
   */
  async invalidatePatientCaches(patientId: string, clinicId: string): Promise<void> {
    await cacheService.invalidatePatientCaches(patientId, clinicId);
  }

  /**
   * Invalidate all caches for a clinic (public method for external use)
   */
  async invalidateClinicCaches(clinicId: string): Promise<void> {
    await cacheService.invalidateClinicCaches(clinicId);
  }
}

// Export singleton instance
export const growthService = new GrowthService();

// Export service class for testing
export default GrowthService;
