import { CACHE_KEYS } from '@naroto/redis/cache-keys';

/**
 * Next.js Cache Tags
 * Maps Redis key patterns to Next.js invalidation tags
 */
export const CACHE_TAGS = {
  clinic: {
    byId: (id: string) => CACHE_KEYS.CLINIC(id),
    members: (id: string) => `clinic:${id}:members`,
    settings: (id: string) => `clinic:${id}:settings`,
    features: (id: string) => `clinic:${id}:features`,
    dashboard: (id: string) => CACHE_KEYS.ADMIN_DASHBOARD(id),
    stats: CACHE_KEYS.GENERAL_STATS()
  },
  user: {
    byId: (id: string) => `user:${id}`,
    clinics: (id: string) => CACHE_KEYS.CLINICS_USER(id)
  },
  patient: {
    byId: (id: string) => CACHE_KEYS.PATIENT(id),
    growth: (id: string) => CACHE_KEYS.PATIENT_GROWTH(id)
  },
  appointment: {
    today: (clinicId: string) => CACHE_KEYS.APPOINTMENT_TODAY(clinicId),
    byDateRange: (from: string, to: string) => `appointments:range:${from}:${to}`
  },
  medical: {
    record: {
      byClinic: (clinicId: string) => CACHE_KEYS.MEDICAL_RECORDS(clinicId)
    },
    immunization: {
      byClinic: (clinicId: string) => CACHE_KEYS.UPCOMING_IMMUNIZATIONS(clinicId)
    }
  },
  doctor: {
    byClinic: (clinicId: string) => CACHE_KEYS.DOCTORS(clinicId)
  },
  workingDays: {
    byClinic: (clinicId: string) => `clinic:${clinicId}:working-days`
  }
} as const;
