/**
 * 🔵 SYSTEM SERVICE
 * - Business logic for system-wide operations
 * - WHO growth standards calculations
 * - Drug dosage calculations
 * - Vaccine schedule management
 * - Caching with versioning
 * - Comprehensive error handling
 * - Transaction integrity
 */

import { logger } from '@naroto/logger';
import { CACHE_KEYS, CACHE_TTL } from '@naroto/redis/cache-keys';

import { ValidationError } from '..';
import { prisma } from '../client';
import { AppError, NotFoundError } from '../error';
import * as systemRepo from '../repositories/system.repo';
import type { ChartType, Gender, MeasurementType } from '../types';
import { cacheService } from './cache.service';

// ==================== INTERFACES & TYPES ====================

export interface GrowthMeasurement {
  ageDays: number;
  measurementType: 'weight' | 'height' | 'headCircumference' | 'bmi';
  value: number;
}

export interface GrowthPercentileResult {
  interpretation: string;
  percentile: number;
  reference: {
    mean: number;
    sd: number;
    lowerBound?: number;
    upperBound?: number;
  };
  standardDeviation: number;
  zScore: number;
}

export interface DrugDosageCalculation {
  calculations: {
    perKg: number;
    totalDaily: number;
    perDose: number;
    weightBased: boolean;
    ageBased: boolean;
    bsaBased: boolean;
  };
  contraindications?: string[];
  dosage: number;
  drugId: string;
  drugName: string;
  duration?: string;
  frequency: string;
  maxDailyDose?: number;
  route?: string;
  unit: string;
  warnings?: string[];
}

export interface VaccineDue {
  ageInDays: number;
  dosesCompleted: number;
  dosesRequired: number;
  dueDate: Date;
  isEligible: boolean;
  isOverdue: boolean;
  nextDoseDue?: Date;
  notes?: string;
  recommendedAge: string;
  vaccineName: string;
}

export interface GrowthStandard {
  ageDays: number;
  ageInMonths?: number | null;
  /**
   * some repository queries return this property name, others used
   * `ageMonths` historically; both are optional for compatibility
   */
  ageMonths?: number | null;
  chartType: ChartType | null;
  gender: Gender;
  id: string;
  lms?: {
    lambda: number;
    mu: number;
    sigma: number;
  } | null;
  mean?: number | null;
  percentile3?: number | null;
  percentile15?: number | null;
  percentile50?: number | null;
  percentile85?: number | null;
  percentile97?: number | null;
  sd1?: number | null;
  sd1neg?: number | null;
  sd2?: number | null;
  sd2neg?: number | null;
  sd3?: number | null;
  sd3neg?: number | null;
  standardDeviation?: number | null;
}

export interface Drug {
  breastfeedingWarning?: boolean | null;
  category?: string | null;
  form?: string | null;
  genericName?: string | null;
  guidelines: DoseGuideline[];
  id: string;
  maxDailyDose?: number | null;
  minAgeDays?: number | null;
  minWeightKg?: number | null;
  name: string;
  pregnancyCategory?: string | null;
  strengths?: string | null;
}

export interface DoseGuideline {
  ageBased?: boolean | null;
  bsaBased?: boolean | null;
  clinicalIndication?: string | null;
  dosePerKg?: number | null;
  dosePerM2?: number | null;
  drugId: string;
  duration?: string | null;
  fixedDose?: number | null;
  frequency?: string | null;
  id: string;
  maxAgeDays?: number | null;
  maxDailyDose?: number | null;
  maxWeightKg?: number | null;
  minAgeDays?: number | null;
  minWeightKg?: number | null;
  notes?: string | null;
  route?: string | null;
  unit?: string | null;
  weightBased?: boolean | null;
}

export interface VaccineSchedule {
  ageInDaysMax?: number | null;
  ageInDaysMin?: number | null;
  dosesRequired: number;
  id: string;
  minIntervalDays?: number | null;
  notes?: string | null;
  vaccineName: string;
}

export interface GrowthVelocityResult {
  period: string;
  velocityPerDay: number;
  velocityPerMonth: number;
  velocityPerYear: number;
  withinNormal: boolean;
}

export interface GrowthTrendAnalysis {
  acceleration?: number | null;
  concern?: boolean;
  message?: string;
  percentileChange?: number;
  trend: string;
  zScoreChange?: number;
}

// ==================== SERVICE CLASS ====================

export class SystemService {
  private readonly CACHE_ENABLED = process.env.CACHE_ENABLED === 'true';

  constructor(private readonly db: typeof prisma = prisma) {}

  // ==================== WHO GROWTH STANDARDS SERVICES ====================

  /**
   * Calculate growth percentiles for a measurement
   */
  async calculateGrowthPercentile(
    patientId: string,
    gender: Gender,
    chartType: ChartType,
    _measurementType: MeasurementType,
    measurement: GrowthMeasurement
  ): Promise<GrowthPercentileResult> {
    const cacheKey = CACHE_KEYS.GROWTH_PERCENTILE(patientId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          logger.debug('Growth percentile cache hit');
          return cached as GrowthPercentileResult;
        }
      }

      // Get reference standards
      const standards = await systemRepo.getWHOGrowthStandards(this.db, gender, chartType);

      if (!standards || standards.length === 0) {
        throw new NotFoundError(`Growth standards for ${gender} ${chartType}`);
      }

      // Find closest age points for interpolation
      const { lower, upper } = await this.findClosestStandardsByAge(gender, chartType, measurement.ageDays);

      if (!(lower || upper)) {
        throw new ValidationError('No growth standards available for this age');
      }

      // Calculate interpolated values
      const reference = this.interpolateStandards(lower, upper, measurement.ageDays);

      // Calculate Z-score
      const zScore = (measurement.value - reference.mean) / reference.sd;

      // Calculate percentile
      const percentile = this.calculatePercentileFromZScore(zScore);

      // Get interpretation
      const interpretation = this.interpretGrowthMeasurement(zScore, chartType);

      const result: GrowthPercentileResult = {
        percentile,
        zScore,
        standardDeviation: reference.sd,
        interpretation,
        reference
      };

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, result, CACHE_TTL.GROWTH_PERCENTILE);
      }

      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to calculate growth percentile', { error, gender, chartType, measurement });
      throw new AppError('Failed to calculate growth percentile', {
        code: 'GROWTH_CALCULATION_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Find closest growth standards for interpolation by age
   */
  private async findClosestStandardsByAge(
    gender: Gender,
    chartType: ChartType,
    ageDays: number
  ): Promise<{
    lower: GrowthStandard | null;
    upper: GrowthStandard | null;
  }> {
    const { lower, upper } = await systemRepo.getClosestGrowthStandards(this.db, gender, chartType, ageDays);
    return { lower, upper };
  }

  async findClosestStandards(
    latitude: number,
    longitude: number,
    radiusKm = 10
  ): Promise<Array<{ latitude: number; longitude: number; [key: string]: unknown }>> {
    const records = (await this.db.wHOGrowthStandard.findMany()) as unknown as Array<{
      latitude: number | null;
      longitude: number | null;
      [key: string]: unknown;
    }>;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    function distance(lat1: number, lon1: number, lat2: number, lon2: number) {
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }
    return records.filter((r): r is { latitude: number; longitude: number; [key: string]: unknown } => {
      if (r.latitude === null || r.longitude === null) return false;
      return distance(latitude, longitude, r.latitude, r.longitude) <= radiusKm;
    });
  }

  /**
   * Calculate BMI and its percentile
   */
  async calculateBMIPercentile(
    gender: Gender,
    ageDays: number,
    weightKg: number,
    heightCm: number
  ): Promise<{
    bmi: number;
    percentile: GrowthPercentileResult;
    classification: string;
  }> {
    try {
      // Calculate BMI
      const heightM = heightCm / 100;
      const bmi = weightKg / (heightM * heightM);

      // Calculate BMI percentile
      const percentile = await this.calculateGrowthPercentile(
        '', // patientId placeholder
        gender,
        'WFA',
        'Weight',
        { ageDays, measurementType: 'bmi', value: bmi }
      );

      // Classify BMI
      const classification = this.classifyBMI(bmi, percentile.percentile, ageDays);

      return { bmi, percentile, classification };
    } catch (error) {
      logger.error('Failed to calculate BMI percentile', { error, gender, ageDays });
      throw new AppError('Failed to calculate BMI percentile', {
        code: 'BMI_CALCULATION_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Track growth over time
   */
  async trackGrowthProgress(patientId: string, measurements: GrowthMeasurement[], gender: Gender) {
    try {
      const progress = await Promise.all(
        measurements.map(async m => {
          const percentile = await this.calculateGrowthPercentile(patientId, gender, 'WFA', 'Weight', m);

          return {
            ...m,
            ...percentile,
            date: new Date() // In real implementation, use actual measurement date
          };
        })
      );

      // Calculate velocity (rate of change)
      const velocity = this.calculateGrowthVelocity(progress);

      return {
        measurements: progress,
        velocity,
        trends: this.analyzeGrowthTrends(progress)
      };
    } catch (error) {
      logger.error('Failed to track growth progress', { error, patientId });
      throw new AppError('Failed to track growth progress', {
        code: 'GROWTH_TRACKING_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== DRUG DOSAGE SERVICES ====================

  /**
   * Calculate drug dosage based on patient parameters
   */
  async calculateDrugDosage(
    drugId: string,
    patientParams: {
      weightKg?: number;
      ageDays?: number;
      ageYears?: number;
      bsa?: number; // Body Surface Area
      renalFunction?: number; // eGFR
      hepaticFunction?: 'normal' | 'mild' | 'moderate' | 'severe';
      pregnancy?: boolean;
      breastfeeding?: boolean;
    },
    clinicalIndication?: string
  ): Promise<DrugDosageCalculation> {
    const cacheKey = CACHE_KEYS.DRUG_DOSAGE(drugId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          logger.debug('Drug dosage cache hit', { drugId });
          return cached as DrugDosageCalculation;
        }
      }

      // Get drug information
      const drug = await systemRepo.getDrugById(this.db, drugId);
      if (!drug) {
        throw new NotFoundError('Drug', drugId);
      }

      // Get applicable guidelines
      const guidelines = await systemRepo.getDoseGuidelines(this.db, drugId);

      // Find matching guideline
      const guideline = this.findMatchingGuideline(guidelines, patientParams, clinicalIndication);

      if (!guideline) {
        throw new ValidationError('No dosage guidelines found for this patient');
      }

      // Calculate dosage
      const calculation = await this.performDosageCalculation(drug, guideline, patientParams);

      // Generate warnings
      const warnings = this.generateDosageWarnings(calculation, patientParams, drug);

      const result: DrugDosageCalculation = {
        drugId: drug.id,
        drugName: drug.name,
        dosage: calculation.perDose,
        unit: guideline.unit || 'mg',
        route: guideline.route || undefined,
        frequency: guideline.frequency || 'As directed',
        duration: guideline.duration || undefined,
        maxDailyDose: guideline.maxDailyDose || undefined,
        warnings,
        contraindications: this.checkContraindications(drug, patientParams),
        calculations: {
          perKg: calculation.perKg,
          totalDaily: calculation.totalDaily,
          perDose: calculation.perDose,
          weightBased: !!guideline.weightBased,
          ageBased: !!guideline.ageBased,
          bsaBased: !!guideline.bsaBased
        }
      };

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, result, CACHE_TTL.DRUG_DOSAGE);
      }

      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to calculate drug dosage', { error, drugId });
      throw new AppError('Failed to calculate drug dosage', {
        code: 'DOSAGE_CALCULATION_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Calculate pediatric dosage based on weight
   */
  async calculatePediatricDosage(drugId: string, weightKg: number, ageMonths?: number, indication?: string) {
    try {
      if (!weightKg || weightKg <= 0) {
        throw new ValidationError('Valid weight is required for pediatric dosage');
      }

      return this.calculateDrugDosage(
        drugId,
        { weightKg, ageDays: ageMonths ? ageMonths * 30 : undefined },
        indication
      );
    } catch (error) {
      logger.error('Failed to calculate pediatric dosage', { error, drugId, weightKg });
      throw error;
    }
  }

  /**
   * Calculate dosage based on body surface area
   */
  async calculateBSABasedDosage(drugId: string, heightCm: number, weightKg: number) {
    try {
      // Calculate BSA using Mosteller formula
      const bsa = Math.sqrt((heightCm * weightKg) / 3600);

      return this.calculateDrugDosage(drugId, { weightKg, bsa });
    } catch (error) {
      logger.error('Failed to calculate BSA-based dosage', { error, drugId });
      throw error;
    }
  }

  /**
   * Check drug interactions
   */
  async checkDrugInteractions(drugIds: string[]) {
    try {
      if (drugIds.length < 2) {
        return { interactions: [], severity: 'none' };
      }

      const drugs = await Promise.all(drugIds.map(id => systemRepo.getDrugById(this.db, id)));

      const interactions: Array<{
        drug1: string;
        drug2: string;
        severity: 'mild' | 'moderate' | 'severe' | 'contraindicated';
        description: string;
        management?: string;
      }> = [];

      // Check each drug pair
      for (let i = 0; i < drugs.length; i++) {
        for (let j = i + 1; j < drugs.length; j++) {
          const drug1 = drugs[i];
          const drug2 = drugs[j];

          if (drug1 && drug2) {
            // In real implementation, check against interaction database
            // This is a placeholder
            const interaction = await this.checkPairInteraction(drug1, drug2);
            if (interaction) {
              interactions.push(interaction);
            }
          }
        }
      }

      const severity = interactions.some(i => i.severity === 'contraindicated')
        ? 'contraindicated'
        : interactions.some(i => i.severity === 'severe')
          ? 'severe'
          : interactions.some(i => i.severity === 'moderate')
            ? 'moderate'
            : interactions.length > 0
              ? 'mild'
              : 'none';

      return { interactions, severity };
    } catch (error) {
      logger.error('Failed to check drug interactions', { error, drugIds });
      throw new AppError('Failed to check drug interactions', {
        code: 'INTERACTION_CHECK_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== VACCINE SCHEDULE SERVICES ====================

  /**
   * Calculate due vaccines for a patient
   */
  async calculateDueVaccines(
    patientId: string,
    dateOfBirth: Date,
    completedVaccines: Array<{
      vaccineName: string;
      date: Date;
      doseNumber: number;
    }>
  ): Promise<VaccineDue[]> {
    const cacheKey = CACHE_KEYS.VACCINE_DUE(patientId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          logger.debug('Vaccine schedule cache hit', { patientId });
          return cached as VaccineDue[];
        }
      }

      // Get vaccine schedule
      const schedule = await systemRepo.getVaccineSchedule(this.db);

      const ageInDays = Math.floor((Date.now() - dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));

      // Calculate due vaccines
      const dueVaccines = schedule
        .map(vaccine => {
          const completed = completedVaccines.filter(c => c.vaccineName === vaccine.vaccineName);

          const dosesCompleted = completed.length;
          const isComplete = dosesCompleted >= vaccine.dosesRequired;

          if (isComplete) {
            return null;
          }

          const isEligible = ageInDays >= (vaccine.ageInDaysMin || 0);
          const isOverdue = vaccine.ageInDaysMax ? ageInDays > vaccine.ageInDaysMax : false;

          // Calculate due date
          const dueDate = new Date(dateOfBirth);
          dueDate.setDate(dueDate.getDate() + (vaccine.ageInDaysMin || 0));

          return {
            vaccineName: vaccine.vaccineName,
            dosesRequired: vaccine.dosesRequired,
            dosesCompleted,
            ageInDays,

            isOverdue: !isComplete && isOverdue,
            isEligible: !isComplete && isEligible,
            recommendedAge: this.formatAgeRange(vaccine.ageInDaysMin, vaccine.ageInDaysMax),
            dueDate
          };
        })
        .filter((v): v is VaccineDue => v !== null && (v.isEligible || v.isOverdue)) as VaccineDue[];

      // Sort by priority (overdue first, then eligible)
      const sorted = dueVaccines.sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return (a.dueDate.getTime() || 0) - (b.dueDate.getTime() || 0);
      });

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, sorted, CACHE_TTL.VACCINE_DUE);
      }

      return sorted;
    } catch (error) {
      logger.error('Failed to calculate due vaccines', { error, patientId });
      throw new AppError('Failed to calculate due vaccines', {
        code: 'VACCINE_CALCULATION_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Validate vaccine administration
   */
  async validateVaccineAdministration(
    vaccineName: string,
    patientAgeDays: number,
    previousDoses: Array<{ date: Date; doseNumber: number }>
  ) {
    try {
      const vaccines = await systemRepo.getVaccineByName(this.db, vaccineName);

      if (vaccines.length === 0) {
        throw new NotFoundError('Vaccine', vaccineName);
      }

      // Find applicable dose based on age
      const applicableVaccine = vaccines.find(
        v => patientAgeDays >= (v.ageInDaysMin || 0) && (!v.ageInDaysMax || patientAgeDays <= v.ageInDaysMax)
      );

      if (!applicableVaccine) {
        return {
          valid: false,
          reason: 'Patient age not within recommended range for this vaccine',
          recommendedAge: this.formatAgeRange(vaccines[0]?.ageInDaysMin, vaccines[0]?.ageInDaysMax)
        };
      }

      const dosesCompleted = previousDoses.length;
      const nextDoseNumber = dosesCompleted + 1;

      if (nextDoseNumber > applicableVaccine.dosesRequired) {
        return {
          valid: false,
          reason: 'All required doses have been administered'
        };
      }

      // Check minimum interval if not first dose
      if (previousDoses.length > 0) {
        const lastDose = previousDoses.at(-1);
        if (!lastDose) {
          return { valid: true, doseNumber: nextDoseNumber, vaccine: applicableVaccine };
        }
        const daysSinceLastDose = Math.floor((Date.now() - lastDose.date.getTime()) / (1000 * 60 * 60 * 24));

        if (applicableVaccine.minimumInterval && daysSinceLastDose < applicableVaccine.minimumInterval) {
          return {
            valid: false,
            reason: `Minimum interval of ${applicableVaccine.minimumInterval} days not met`,
            nextEligibleDate: new Date(
              lastDose.date.getTime() + applicableVaccine.minimumInterval * 24 * 60 * 60 * 1000
            )
          };
        }
      }

      return {
        valid: true,
        doseNumber: nextDoseNumber,
        vaccine: applicableVaccine
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to validate vaccine', { error, vaccineName });
      throw new AppError('Failed to validate vaccine', {
        code: 'VACCINE_VALIDATION_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== SYSTEM CACHE WARMING ====================

  /**
   * Warm up system caches
   */
  async warmSystemCaches() {
    try {
      logger.info('Starting system cache warming');

      const [growthStandards, drugs, vaccineSchedule] = await Promise.all([
        systemRepo.getAllWHOGrowthStandards(this.db),
        systemRepo.getAllDrugs(this.db),
        systemRepo.getVaccineSchedule(this.db)
      ]);

      // Cache growth standards
      const growthPromises = growthStandards.map(standard => {
        const key = CACHE_KEYS.GROWTH_STANDARD(standard.gender, standard.chartType as string, standard.ageDays);
        return cacheService.set(key, standard, CACHE_TTL.GROWTH_STANDARD);
      });

      // Cache drugs
      const drugPromises = drugs.map(drug => {
        const key = CACHE_KEYS.DRUG(drug.id);
        return cacheService.set(key, drug, CACHE_TTL.DRUG);
      });

      // Cache vaccine schedule
      await cacheService.set(CACHE_KEYS.VACCINE_SCHEDULE('all', 'all'), vaccineSchedule, CACHE_TTL.VACCINE_SCHEDULE);

      await Promise.all([...growthPromises, ...drugPromises]);

      logger.info('System caches warmed successfully', {
        growthCount: growthStandards.length,
        drugCount: drugs.length,
        vaccineCount: vaccineSchedule.length
      });

      return {
        success: true,
        counts: {
          growthStandards: growthStandards.length,
          drugs: drugs.length,
          vaccines: vaccineSchedule.length
        }
      };
    } catch (error) {
      logger.error('Failed to warm system caches', { error });
      throw new AppError('Failed to warm system caches', {
        code: 'CACHE_WARMING_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth() {
    try {
      const startTime = Date.now();

      // Test database connection
      await this.db.$queryRaw`SELECT 1`;

      // Test cache connection if enabled
      let cacheStatus = 'disabled';
      if (this.CACHE_ENABLED) {
        const cacheHealthy = await cacheService.healthCheck();
        cacheStatus = cacheHealthy ? 'healthy' : 'unhealthy';
      }

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        database: 'connected',
        cache: cacheStatus,
        environment: process.env.NODE_ENV || 'development'
      };
    } catch (error) {
      logger.error('System health check failed', { error });
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        cache: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Clear all system caches (admin only)
   */
  async clearSystemCaches() {
    try {
      const patterns = [
        CACHE_KEYS.GROWTH_STANDARD_PATTERN('*', '*'),
        CACHE_KEYS.GROWTH_PERCENTILE_PATTERN('*'),
        CACHE_KEYS.DRUG_PATTERN('*'),
        CACHE_KEYS.DRUG_DOSAGE_PATTERN('*'),
        CACHE_KEYS.VACCINE_DUE_PATTERN('*')
      ];

      let totalCleared = 0;
      for (const pattern of patterns) {
        await cacheService.invalidatePattern(pattern);
        totalCleared++;
      }

      await cacheService.invalidate(CACHE_KEYS.VACCINE_SCHEDULE('*', '*'));

      logger.info('System caches cleared', { count: totalCleared + 1 });
      return { success: true, clearedCount: totalCleared + 1 };
    } catch (error) {
      logger.error('Failed to clear system caches', { error });
      throw new AppError('Failed to clear system caches', {
        code: 'CACHE_CLEAR_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get drug lookup (for autocomplete/search)
   */
  async searchDrugsWithDetails(query: string, limit = 20) {
    try {
      const drugs = await systemRepo.searchDrugs(this.db, query, limit);

      return drugs.map((drug: Drug) => ({
        id: drug.id,
        name: drug.name,
        genericName: drug.genericName,
        category: drug.category,
        form: drug.form,
        strengths: drug.strengths,
        hasGuidelines: drug.guidelines.length > 0,
        commonIndications: this.extractCommonIndications(drug.guidelines)
      }));
    } catch (error) {
      logger.error('Failed to search drugs', { error, query });
      throw new AppError('Failed to search drugs', {
        code: 'DRUG_SEARCH_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Find closest growth standards for interpolation
  private async findClosestStandards(
    gender: Gender,
    chartType: ChartType,
    ageDays: number
  ): Promise<{
    lower?: GrowthStandard | null;
    upper?: GrowthStandard | null;
  }> {
    const [lower, upper] = await Promise.all([
      systemRepo.getGrowthStandardByAge(this.db, gender, chartType, ageDays),
      systemRepo.getGrowthStandardByAge(this.db, gender, chartType, ageDays)
    ]);

    return { lower, upper };
  }
  }

  /**
   * Interpolate between two growth standards
   */
  private interpolateStandards(
    lower: GrowthStandard | null | undefined,
    upper: GrowthStandard | null | undefined,
    targetAge: number
  ): {
    mean: number;
    sd: number;
    lowerBound?: number;
    upperBound?: number;
  } {
    if (!(lower || upper)) {
      throw new ValidationError('No growth standards available');
    }

    if (!lower) {
      return {
        mean: upper?.lms?.mu || upper?.mean || 0,
        sd: upper?.lms?.sigma || upper?.standardDeviation || 1,
        lowerBound: upper?.sd2neg || upper?.percentile3 || undefined,
        upperBound: upper?.sd2 || upper?.percentile97 || undefined
      };
    }

    if (!upper) {
      return {
        mean: lower.lms?.mu || lower.mean || 0,
        sd: lower.lms?.sigma || lower.standardDeviation || 1,
        lowerBound: lower.sd2neg || lower.percentile3 || undefined,
        upperBound: lower.sd2 || lower.percentile97 || undefined
      };
    }

    if (lower.ageDays === targetAge || lower.ageDays === upper.ageDays) {
      return {
        mean: lower.lms?.mu || lower.mean || 0,
        sd: lower.lms?.sigma || lower.standardDeviation || 1,
        lowerBound: lower.sd2neg || lower.percentile3 || undefined,
        upperBound: lower.sd2 || lower.percentile97 || undefined
      };
    }

    // Linear interpolation
    const ratio = (targetAge - lower.ageDays) / (upper.ageDays - lower.ageDays);

    const meanLower = lower.lms?.mu || lower.mean || 0;
    const meanUpper = upper.lms?.mu || upper.mean || 0;
    const mean = meanLower + (meanUpper - meanLower) * ratio;

    const sdLower = lower.lms?.sigma || lower.standardDeviation || 1;
    const sdUpper = upper.lms?.sigma || upper.standardDeviation || 1;
    const sd = sdLower + (sdUpper - sdLower) * ratio;

    const lowerBoundLower = lower.sd2neg || lower.percentile3 || mean - 2 * sd;
    const lowerBoundUpper = upper.sd2neg || upper.percentile3 || mean - 2 * sd;
    const lowerBound = lowerBoundLower + (lowerBoundUpper - lowerBoundLower) * ratio;

    const upperBoundLower = lower.sd2 || lower.percentile97 || mean + 2 * sd;
    const upperBoundUpper = upper.sd2 || upper.percentile97 || mean + 2 * sd;
    const upperBound = upperBoundLower + (upperBoundUpper - upperBoundLower) * ratio;

    return { mean, sd, lowerBound, upperBound };
  }

  /**
   * Calculate percentile from Z-score
   */
  private calculatePercentileFromZScore(zScore: number): number {
    // Using standard normal CDF approximation
    const sign = zScore < 0 ? -1 : 1;
    const absZ = Math.abs(zScore);

    // Formula: 0.5 * (1 + sign * (1 - Math.exp(-2 * absZ * absZ / Math.PI)))
    const percentile = 0.5 * (1 + sign * (1 - Math.exp((-2 * absZ * absZ) / Math.PI)));

    return Math.round(percentile * 100 * 10) / 10; // Round to 1 decimal
  }

  /**
   * Interpret growth measurement
   */
  private interpretGrowthMeasurement(zScore: number, chartType: ChartType): string {
    if (chartType === 'WFA' || chartType === 'HFA') {
      if (zScore < -3) return 'Severely stunted';
      if (zScore < -2) return 'Stunted';
      if (zScore <= 2) return 'Normal';
      if (zScore <= 3) return 'Above normal';
      return 'Severely above normal';
    }

    if (chartType === 'HcFA') {
      if (zScore < -3) return 'Microcephaly';
      if (zScore < -2) return 'Below average';
      if (zScore <= 2) return 'Normal';
      if (zScore <= 3) return 'Above average';
      return 'Macrocephaly';
    }

    if (zScore < -3) return 'Severely below average';
    if (zScore < -2) return 'Below average';
    if (zScore <= 2) return 'Average';
    if (zScore <= 3) return 'Above average';
    return 'Severely above average';
  }

  /**
   * Classify BMI
   */
  private classifyBMI(_bmi: number, percentile: number, ageDays: number): string {
    const ageYears = ageDays / 365.25;

    if (ageYears < 2) {
      if (percentile < 5) return 'Underweight';
      if (percentile <= 85) return 'Healthy weight';
      if (percentile <= 95) return 'Overweight';
      return 'Obese';
    }
    if (percentile < 5) return 'Underweight';
    if (percentile < 85) return 'Healthy weight';
    if (percentile < 95) return 'Overweight';
    if (percentile < 98) return 'Obese';
    return 'Severely obese';
  }

  /**
   * Calculate growth velocity
   */
  private calculateGrowthVelocity(measurements: (GrowthMeasurement & { date: Date })[]): GrowthVelocityResult[] | null {
    if (measurements.length < 2) {
      return null;
    }

    const velocities = [];
    for (let i = 1; i < measurements.length; i++) {
      const current = measurements[i];
      const previous = measurements[i - 1];

      // ensure both measurements have valid dates
      if (!(current?.date && previous?.date)) continue;

      const currentMs = current.date.getTime();
      const previousMs = previous.date.getTime();
      const daysDiff = (currentMs - previousMs) / (1000 * 60 * 60 * 24);
      if (daysDiff < 7) continue; // Skip if less than a week

      const valueDiff = current.value - previous.value;

      velocities.push({
        period: `${previous.date.toLocaleDateString()} - ${current.date.toLocaleDateString()}`,
        velocityPerDay: valueDiff / daysDiff,
        velocityPerMonth: (valueDiff / daysDiff) * 30.44,
        velocityPerYear: (valueDiff / daysDiff) * 365.25,
        withinNormal: this.isVelocityNormal(valueDiff / daysDiff, current.measurementType, current.ageDays)
      });
    }

    return velocities;
  }

  /**
   * Analyze growth trends
   */
  private analyzeGrowthTrends(
    measurements: (GrowthPercentileResult & { value: number; date: Date })[]
  ): GrowthTrendAnalysis {
    if (measurements.length < 2) {
      return { trend: 'insufficient_data' };
    }

    const first = measurements[0];
    const last = measurements.at(-1);

    if (!(first && last)) {
      return { trend: 'insufficient_data' };
    }

    const percentileChange = last.percentile - first.percentile;
    const zScoreChange = last.zScore - first.zScore;

    let trend: string;
    if (Math.abs(percentileChange) < 5) {
      trend = 'stable';
    } else if (percentileChange > 15) {
      trend = 'rapid_increase';
    } else if (percentileChange > 5) {
      trend = 'gradual_increase';
    } else if (percentileChange < -15) {
      trend = 'rapid_decrease';
    } else if (percentileChange < -5) {
      trend = 'gradual_decrease';
    } else {
      trend = 'stable';
    }

    return {
      trend,
      percentileChange,
      zScoreChange,
      acceleration: measurements.length > 2 ? this.calculateAcceleration(measurements) : null,
      concern:
        Math.abs(zScoreChange) > 1.5 || (zScoreChange < -1 && last.zScore < -1) || (zScoreChange > 1 && last.zScore > 2)
    };
  }

  /**
   * Calculate acceleration (second derivative)
   */
  private calculateAcceleration(measurements: Array<{ value: number; date: Date }>): number {
    if (measurements.length < 3) return 0;

    const m0 = measurements[0];
    const m1 = measurements[1];
    const mPrevLast = measurements.at(-2);
    const mLast = measurements.at(-1);

    if (!(m0 && m1 && mPrevLast && mLast)) return 0;

    const firstVelocity = (m1.value - m0.value) / ((m1.date.getTime() - m0.date.getTime()) / (1000 * 60 * 60 * 24));

    const lastVelocity =
      (mLast.value - mPrevLast.value) / ((mLast.date.getTime() - mPrevLast.date.getTime()) / (1000 * 60 * 60 * 24));

    const timeDiff = (mLast.date.getTime() - m0.date.getTime()) / (1000 * 60 * 60 * 24);

    return timeDiff > 0 ? (lastVelocity - firstVelocity) / timeDiff : 0;
  }

  /**
   * Find matching guideline based on patient parameters
   */
  private findMatchingGuideline(
    guidelines: DoseGuideline[],
    params: {
      weightKg?: number;
      ageDays?: number;
      bsa?: number;
    },
    indication?: string
  ): DoseGuideline | undefined {
    return guidelines.find(g => {
      // Match indication if provided
      if (
        indication &&
        g.clinicalIndication &&
        !g.clinicalIndication.toLowerCase().includes(indication.toLowerCase())
      ) {
        return false;
      }

      // Match age range
      if (params.ageDays !== undefined) {
        if (g.minAgeDays && params.ageDays < g.minAgeDays) return false;
        if (g.maxAgeDays && params.ageDays > g.maxAgeDays) return false;
      }

      // Match weight range
      if (params.weightKg !== undefined) {
        if (g.minWeightKg && params.weightKg < g.minWeightKg) return false;
        if (g.maxWeightKg && params.weightKg > g.maxWeightKg) return false;
      }

      // Match calculation type availability
      if (g.bsaBased && params.bsa === undefined) return false;
      if (g.weightBased && params.weightKg === undefined) return false;

      return true;
    });
  }

  private async performDosageCalculation(
    _drug: Drug,
    guideline: DoseGuideline,
    params: { weightKg?: number; bsa?: number }
  ) {
    let perDose = 0;
    let totalDaily = 0;
    let perKg = 0;

    if (guideline.fixedDose) {
      perDose = guideline.fixedDose;
    } else if (guideline.weightBased && guideline.dosePerKg && params.weightKg) {
      perKg = guideline.dosePerKg;
      perDose = guideline.dosePerKg * params.weightKg;
    } else if (guideline.bsaBased && guideline.dosePerM2 && params.bsa) {
      perDose = guideline.dosePerM2 * params.bsa;
    }

    // Apply frequency logic (simplified)
    const freqMap: Record<string, number> = { QD: 1, BID: 2, TID: 3, QID: 4 };
    const multiplier = guideline.frequency ? freqMap[guideline.frequency] || 1 : 1;
    totalDaily = perDose * multiplier;

    return { perDose, totalDaily, perKg };
  }

  private generateDosageWarnings(
    _calc: { perDose: number; totalDaily: number; perKg: number },
    params: { pregnancy?: boolean; breastfeeding?: boolean },
    drug: Drug
  ): string[] {
    const warnings: string[] = [];
    if (drug.pregnancyCategory === 'X' && params.pregnancy) warnings.push('Contraindicated in pregnancy');
    if (drug.breastfeedingWarning && params.breastfeeding) warnings.push('Use with caution while breastfeeding');
    return warnings;
  }

  private checkContraindications(_drug: Drug, _params: Record<string, unknown>): string[] {
    return [];
  }

  private checkPairInteraction(
    _d1: Drug,
    _d2: Drug
  ): {
    drug1: string;
    drug2: string;
    severity: 'mild' | 'moderate' | 'severe' | 'contraindicated';
    description: string;
    management?: string;
  } | null {
    return null;
  }

  private formatAgeRange(min?: number | null, max?: number | null): string {
    if (min && max) return `${min}-${max} days`;
    if (min) return `From ${min} days`;
    if (max) return `Up to ${max} days`;
    return 'Any age';
  }

  private extractCommonIndications(guidelines: DoseGuideline[]): string[] {
    return Array.from(new Set(guidelines.map(g => g.clinicalIndication).filter((i): i is string => !!i)));
  }

  /**
   * Check if velocity is normal
   */
  private isVelocityNormal(velocityPerDay: number, type: string, ageDays: number): boolean {
    // Reference values would come from WHO standards
    // This is a simplified version
    const ageYears = ageDays / 365.25;

    if (type === 'weight' && ageYears < 1) {
      return velocityPerDay > 0.015 && velocityPerDay < 0.06;
    }
    if (type === 'weight' && ageYears < 5) {
      return velocityPerDay > 0.01 && velocityPerDay < 0.03;
    }
    if (type === 'weight' && ageYears < 10) {
      return velocityPerDay > 0.005 && velocityPerDay < 0.02;
    }
    if (type === 'weight') {
      return velocityPerDay > 0 && velocityPerDay < 0.01;
    }

    if (type === 'height' && ageYears < 1) {
      return velocityPerDay > 0.002 && velocityPerDay < 0.01;
    }
    if (type === 'height' && ageYears < 5) {
      return velocityPerDay > 0.001 && velocityPerDay < 0.005;
    }
    if (type === 'height') {
      return velocityPerDay > 0 && velocityPerDay < 0.003;
    }

    if (type === 'headCircumference' && ageYears < 1) {
      return velocityPerDay > 0.02 && velocityPerDay < 0.1;
    }
    if (type === 'headCircumference') {
      return velocityPerDay > 0 && velocityPerDay < 0.05;
    }

    if (type === 'bmi') {
      // Simplified BMI velocity thresholds (per day)
      if (ageYears < 2) return velocityPerDay > 0.01 && velocityPerDay < 0.05;
      return velocityPerDay > 0 && velocityPerDay < 0.02;
    }

    // Unknown measurement type: be conservative and return false if extreme
    return Math.abs(velocityPerDay) < 1;
  }
}
