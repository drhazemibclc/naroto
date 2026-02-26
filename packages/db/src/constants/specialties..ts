// src/constants/specialties.ts
export const DOCTOR_SPECIALTIES = [
  {
    label: 'Pediatrician',
    value: 'pediatrician',
    department: 'Pediatrics'
  },
  {
    label: 'Pediatric Cardiologist',
    value: 'pediatric_cardiologist',
    department: 'Pediatric Cardiology'
  },
  {
    label: 'Pediatric Neurologist',
    value: 'pediatric_neurologist',
    department: 'Pediatric Neurology'
  },
  {
    label: 'Pediatric Gastroenterologist',
    value: 'pediatric_gastroenterologist',
    department: 'Pediatric Gastroenterology'
  },
  {
    label: 'Pediatric Endocrinologist',
    value: 'pediatric_endocrinologist',
    department: 'Pediatric Endocrinology'
  },
  {
    label: 'Neonatologist',
    value: 'neonatologist',
    department: 'Neonatology'
  },
  {
    label: 'Pediatric Surgeon',
    value: 'pediatric_surgeon',
    department: 'Pediatric Surgery'
  }
] as const;

// src/constants/growth.ts
export const GROWTH_CHART_TYPES = {
  WFA: 'Weight-for-Age',
  HFA: 'Height-for-Age',
  WFH: 'Weight-for-Height',
  BMI: 'BMI-for-Age',
  HC: 'Head-Circumference'
} as const;

export const WHO_CLASSIFICATIONS = {
  SEVERE_UNDERWEIGHT: { min: Number.NEGATIVE_INFINITY, max: -3 },
  UNDERWEIGHT: { min: -3, max: -2 },
  AT_RISK: { min: -2, max: -1 },
  NORMAL: { min: -1, max: 1 },
  OVERWEIGHT: { min: 1, max: 2 },
  OBESE: { min: 2, max: 3 },
  SEVERE_OBESE: { min: 3, max: Number.POSITIVE_INFINITY }
} as const;

// src/constants/appointments.ts
export const APPOINTMENT_STATUS = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW'
] as const;

export const APPOINTMENT_TYPES = [
  'CHECKUP',
  'FOLLOW_UP',
  'VACCINATION',
  'EMERGENCY',
  'CONSULTATION',
  'PROCEDURE'
] as const;

export const DEFAULT_APPOINTMENT_DURATION = 30; // minutes
