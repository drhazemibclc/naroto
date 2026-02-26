// src/utils/validation/dose.ts
import { db, prisma } from '../../client';
import type { DoseGuideline, PrescriptionItem } from '../../types/dose';

export interface DoseValidationResult {
  errors: string[];
  valid: boolean;
  warnings: string[];
}

export class DoseValidator {
  /**
   * Validate medication dose for pediatric patient
   */
  async validateDose(
    patientId: string,
    drugId: string,
    doseValue: number,
    doseUnit: string
  ): Promise<DoseValidationResult> {
    const result: DoseValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Get patient's latest weight
    const vitalSign = await prisma.vitalSigns.findFirst({
      where: { patientId },
      orderBy: { recordedAt: 'desc' },
      include: { growthRecords: true }
    });

    const weightKg = vitalSign?.growthRecords[0]?.weight;

    if (!weightKg) {
      result.warnings.push('Patient weight not found. Unable to validate weight-based dose.');
    }

    // Get drug guidelines
    const guidelines = await prisma.doseGuideline.findMany({
      where: { drugId }
    });

    if (guidelines.length === 0) {
      result.warnings.push('No dosing guidelines found for this medication');
      return result;
    }

    // Find matching guideline
    const guideline = guidelines.find(g => g.doseUnit === doseUnit);

    if (!guideline) {
      result.warnings.push(`No guidelines found for unit: ${doseUnit}. Please verify dosage.`);
      return result;
    }

    // Check fixed dose limits
    if (guideline.minDosePerKg !== null && doseValue < guideline.minDosePerKg) {
      result.errors.push(
        `Dose (${doseValue}${doseUnit}) is below minimum recommended dose (${guideline.minDosePerKg}${doseUnit})`
      );
    }

    if (guideline.maxDosePerKg !== null && doseValue > guideline.maxDosePerKg) {
      result.errors.push(
        `Dose (${doseValue}${doseUnit}) exceeds maximum recommended dose (${guideline.maxDosePerKg}${doseUnit})`
      );
    }

    // Check weight-based dose if weight available
    if (weightKg && guideline.minDosePerKg !== null) {
      const dosePerKg = doseValue / weightKg;

      if (guideline.minDosePerKg !== null && dosePerKg < guideline.minDosePerKg) {
        result.errors.push(
          `Dose per kg (${dosePerKg.toFixed(2)}${doseUnit}/kg) is below minimum (${guideline.minDosePerKg}${doseUnit}/kg)`
        );
      }

      if (guideline.maxDosePerKg !== null && dosePerKg > guideline.maxDosePerKg) {
        result.errors.push(
          `Dose per kg (${dosePerKg.toFixed(2)}${doseUnit}/kg) exceeds maximum (${guideline.maxDosePerKg}${doseUnit}/kg)`
        );
      }
    }

    result.valid = result.errors.length === 0;
    return result;
  }
}

export async function validateDoseAgainstGuidelines(
  item: PrescriptionItem,
  guidelines: DoseGuideline[],
  patientId: string
) {
  if (!guidelines.length) {
    return;
  }

  const guideline = guidelines.find(g => g.doseUnit === item.dosageUnit);
  if (!guideline) {
    return;
  }

  // Load patient weight (latest)
  const vitals = await db.vitalSigns.findFirst({
    where: { patientId, growthRecords: { some: { weight: { not: null } } } },
    orderBy: { recordedAt: 'desc' },
    include: {
      growthRecords: {
        select: {
          weight: true,
          height: true
        }
      }
    }
  });

  const weightKg = vitals?.growthRecords[0]?.weight ?? null;

  // --- Fixed dose validation ---
  if (
    (guideline.minDose != null && item.dosageValue < guideline.minDose) ||
    (guideline.maxDose != null && item.dosageValue > guideline.maxDose)
  ) {
    throw new Error(`Dose ${item.dosageValue}${item.dosageUnit} is outside recommended fixed range`);
  }

  // --- Weight-based validation (mg/kg) ---
  if (weightKg != null) {
    const dosePerKg = item.dosageValue / weightKg;

    if (
      (guideline.minDosePerKg != null && dosePerKg < guideline.minDosePerKg) ||
      (guideline.maxDosePerKg != null && dosePerKg > guideline.maxDosePerKg)
    ) {
      throw new Error(`Dose equals ${dosePerKg.toFixed(2)}${item.dosageUnit}/kg, outside safe pediatric range`);
    }
  }
}

export const doseValidator = new DoseValidator();
