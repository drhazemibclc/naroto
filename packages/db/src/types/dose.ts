export interface DoseGuideline {
  doseUnit?: string | null;
  maxDose?: number | null;
  maxDosePerKg?: number | null;
  minDose?: number | null;
  minDosePerKg?: number | null;
}

export interface PrescriptionItem {
  dosageUnit: string;
  dosageValue: number;
  drugId: string;
}
