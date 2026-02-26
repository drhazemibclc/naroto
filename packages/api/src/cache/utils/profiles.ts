/**
 * ⏱️ Cache Life Profiles
 * Following BEST_PRACTICES.md - Different data has different freshness requirements
 *
 * Next.js 16+ Built-in Cache Profiles:
 * - 'seconds'  - Very short-lived, revalidates in seconds
 * - 'minutes'  - Short-lived, revalidates in minutes
 * - 'hours'    - Medium-lived, revalidates in hours
 * - 'days'     - Long-lived, revalidates in days
 * - 'weeks'    - Very long-lived, revalidates in weeks
 * - 'max'      - Maximum lifetime
 */
export const CACHE_PROFILES = {
  // ==================== REAL-TIME DATA ====================
  realtime: {
    stale: 10, // 10 seconds - serve stale while revalidating
    revalidate: 30, // 30 seconds - revalidate in background
    expire: 300 // 5 minutes - hard expiration
  },

  // ==================== MEDICAL SHORT-TERM ====================
  medicalShort: {
    stale: 300, // 5 minutes
    revalidate: 600, // 10 minutes
    expire: 1800 // 30 minutes
  },

  // ==================== MEDICAL MEDIUM-TERM ====================
  medicalMedium: {
    stale: 3600, // 1 hour
    revalidate: 7200, // 2 hours
    expire: 86_400 // 24 hours
  },

  // ==================== MEDICAL LONG-TERM ====================
  medicalLong: {
    stale: 43_200, // 12 hours
    revalidate: 86_400, // 24 hours
    expire: 604_800 // 7 days
  },

  // ==================== REFERENCE DATA ====================
  reference: {
    stale: 604_800, // 7 days
    revalidate: 1_209_600, // 14 days
    expire: 2_592_000 // 30 days
  },

  // ==================== STATIC REFERENCE ====================
  max: {
    stale: 2_592_000, // 30 days
    revalidate: 5_184_000, // 60 days
    expire: 7_776_000 // 90 days
  }
} as const;
export const cacheProfiles = CACHE_PROFILES;
export type CacheProfile = keyof typeof CACHE_PROFILES;

/**
 * Next.js 16+ Built-in Cache Life Profiles
 * These can be used directly with cacheLife() and revalidateTag()
 */
export type BuiltInCacheProfile = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'max';

/**
 * 📋 Cache Strategy Mapping
 * Maps entity types to appropriate cache profiles
 */
export const CACHE_STRATEGY = {
  // Admin & Dashboard
  'admin.dashboard': 'medicalShort',
  'admin.activity': 'medicalShort',
  'admin.reports': 'medicalMedium',

  // Clinic
  'clinic.settings': 'medicalMedium',
  'clinic.counts': 'medicalShort',
  'clinic.features': 'medicalMedium',

  // Patients
  'patient.profile': 'medicalShort',
  'patient.list': 'medicalShort',
  'patient.appointments': 'realtime',
  'patient.records': 'medicalLong',
  'patient.growth': 'medicalLong',
  'patient.vitals': 'realtime',
  'patient.billing': 'medicalShort',

  // Doctors
  'doctor.profile': 'medicalMedium',
  'doctor.list': 'medicalMedium',
  'doctor.workingDays': 'medicalMedium',
  'doctor.performance': 'medicalShort',
  'doctor.appointments': 'realtime',

  // Staff
  'staff.profile': 'medicalMedium',
  'staff.list': 'medicalMedium',

  // Appointments
  'appointment.today': 'realtime',
  'appointment.upcoming': 'realtime',
  'appointment.detail': 'medicalShort',
  'appointment.history': 'medicalShort',

  // Services
  'service.list': 'medicalMedium',
  'service.detail': 'medicalMedium',
  'service.available': 'medicalShort',

  // Financial
  'payment.list': 'medicalShort',
  'payment.detail': 'medicalShort',
  'expense.list': 'medicalMedium',

  // Medical
  'medical.diagnosis': 'medicalLong',
  'medical.prescriptions': 'medicalShort',
  'medical.immunizations': 'medicalLong',
  'medical.lab': 'medicalShort',

  // Reference
  'reference.who': 'max',
  'reference.drugs': 'reference',
  'reference.vaccines': 'max',

  // System
  'system.settings': 'medicalMedium'
} as const;

export type CacheStrategyKey = keyof typeof CACHE_STRATEGY;
