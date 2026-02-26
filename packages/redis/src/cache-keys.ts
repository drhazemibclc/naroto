/**
 * Centralized cache key management
 * Prevents key collisions and enables consistent cache invalidation
 */

export const CACHE_KEYS = {
  PAYMENT: (id: string) => `payment:${id}`,
  PAYMENTS_CLINIC: (clinicId: string) => `clinic:${clinicId}:payments`,
  VITAL_SIGNS: (id: string) => `vital-signs:${id}`,
  VISIT: (id: string) => `visit:${id}`,
  CLINIC_VACCINATION_STATS: (clinicId: string) => `clinic:${clinicId}:vaccination-stats`,
  PATIENT_DUE_VACCINES: (patientId: string) => `patient:${patientId}:due-vaccines`,
  VACCINE_SCHEDULE: (ageMonths: string, vaccineName: string) => `patient:${ageMonths}:vaccine-schedule:${vaccineName}`,
  OVERDUE_IMMUNIZATIONS: (clinicId: string) => `clinic:${clinicId}:immunizations:overdue`,
  CLINIC_IMMUNIZATIONS: (clinicId: string) => `clinic:${clinicId}:immunizations`,
  PATIENT_IMMUNIZATIONS: (patientId: string) => `patient:${patientId}:immunizations`,
  IMMUNIZATION: (id: string) => `immunization:${id}`,
  DOCTOR_SCHEDULE: (doctorId: string, date: string) => `doctor:${doctorId}:schedule:date:${date}`,
  DOCTOR_VISITS: (doctorId: string, date: string) => `doctor:${doctorId}:visits:date:${date}`,
  UPCOMING_VISITS: (clinicId: string) => `clinic:${clinicId}:visits:upcoming`,
  TODAY_VISITS: (clinicId: string) => `clinic:${clinicId}:visits:today`,
  RECENT_VISITS: (clinicId: string, limit: number) => `clinic:${clinicId}:visits:recent:${limit}`,
  PATIENT_VISITS: (patientId: string) => `patient:${patientId}:visits`,
  CLINIC_VISITS: (clinicId: string) => `clinic:${clinicId}:visits`,
  APPOINTMENTS_BY_DOCTOR: (doctorId: string, date: string) => `doctor:${doctorId}:appointments:date:${date}`,
  APPOINTMENTS_BY_CLINIC: (clinicId: string, date: string) => `clinic:${clinicId}:appointments:date:${date}`,
  SCHEDULE: (clinicId: string, date: string) => `clinic:${clinicId}:schedule:date:${date}`,
  PATIENTS_LIST: (clinicId: string, search: string, status: string, gender: string, page: number, limit: number) =>
    `clinic:${clinicId}:patients:${search}:${status}:${gender}:${page}:${limit}`,
  COUNT: (clinicId: string) => `clinic:${clinicId}:patient:count`,
  SEARCH: (clinicId: string, query: string, searchBy: string) =>
    `clinic:${clinicId}:patients:search:${query}:${searchBy}`,
  PATIENT: (id: string) => `patient:${id}`,
  VISIT_STATISTICS: (clinicId: string) => `clinic:${clinicId}:visit-statistics`,
  VISIT_COUNT_BY_STATUS: (clinicId: string, status: string) => `clinic:${clinicId}:visits:status:${status}:count`,
  MONTH_VISIT_COUNT: (clinicId: string, year: number, month: number) =>
    `clinic:${clinicId}:visits:month:${year}:${month}:count`,
  TODAY_VISIT_COUNT: (clinicId: string) => `clinic:${clinicId}:visits:today:count`,
  PATIENT_FULL: (id: string) => `patient:${id}:full`,
  PATIENT_GROWTH: (patientId: string) => `patient:${patientId}:growth`,
  PATIENT_LATEST: (patientId: string) => `patient:${patientId}:growth:latest`,
  PATIENT_CHART: (patientId: string, type: string) => `patient:${patientId}:chart:${type}`,
  APPOINTMENT: (id: string) => `appointment:${id}`,
  APPOINTMENT_STATS: (clinicId: string) => `clinic:${clinicId}:stats`,
  APPOINTMENT_STAT_RANGE: (clinicId: string, from: string, to: string) =>
    `clinic:${clinicId}:stats:range:${from}:${to}`,
  STATS: (clinicId: string) => `clinic:${clinicId}:stats`,
  TREND: (clinicId: string, period: string) => `clinic:${clinicId}:stats:registration-trend:${period}`,
  CLINIC: (id: string) => `clinic:${id}`,
  CLINIC_STATS: (clinicId: string) => `clinic:${clinicId}:stats`,
  GENERAL_STATS: () => 'general:stats',
  FEATURES: () => 'features',
  MEDICAL_RECORDS: (clinicId: string) => `clinic:${clinicId}:medical-records`,
  IMMUNIZATIONS: (clinicId: string) => `clinic:${clinicId}:immunizations:upcoming`,
  PERFORMANCE: (clinicId: string) => `clinic:${clinicId}:performance:monthly`,

  VACCINE_DUE: (patientId: string) => `patient:${patientId}:vaccine-due`,
  DRUG_DOSAGE: (clinicId: string) => `clinic:${clinicId}:drug-dosage`,
  DIAGNOSIS: (clinicId: string) => `clinic:${clinicId}:diagnosis`,
  PATIENT_DIAGNOSES: (patientId: string) => `patient:${patientId}:diagnoses`,
  MEDICAL_RECORD: (id: string) => `medical-record:${id}`,
  PATIENT_MEDICAL_RECORDS: (patientId: string) => `patient:${patientId}:medical-records`,
  LAB_TEST: (id: string) => `lab-test:${id}`,
  PATIENT_LAB_TESTS: (patientId: string) => `patient:${patientId}:lab-tests`,
  PATIENT_VITALS: (patientId: string) => `patient:${patientId}:vitals`,
  PATIENT_PRESCRIPTIONS: (patientId: string) => `patient:${patientId}:prescriptions`,
  // Individual records
  GROWTH_PERCENTILE: (patientId: string) => `growth:percentile:${patientId}`,
  GROWTH_RECORD: (id: string) => `growth:record:${id}`,
  ADMIN_DASHBOARD: (clinicId: string) => `clinic:${clinicId}:dashboard`,
  PATIENT_DASHBOARD: (patientId: string) => `patient:${patientId}:dashboard`,
  ADMIN_DASHBOARD_RANGE: (clinicId: string, from: string, to: string) =>
    `clinic:${clinicId}:dashboard:range:${from}:${to}`,
  DOCTOR_APPOINTMENT: (doctorId: string, appointmentId: string) => `doctor:${doctorId}:appointment:${appointmentId}`,
  DOCTOR_APPOINTMENTS_DATE: (doctorId: string, date: string) => `doctor:${doctorId}:appointments:date:${date}`,
  DOCTOR: (id: string, clinicId: string) => `doctor:${id}:clinic:${clinicId}`,
  DOCTORS_AVAILABLE: (clinicId: string) => `clinic:${clinicId}:doctors:available`,
  DOCTORS_AVAILABLE_DATE: (clinicId: string, date: string) => `clinic:${clinicId}:doctors:available:${date}`,
  DOCTORS_AVAILABLE_DAY: (clinicId: string, day: string) => `clinic:${clinicId}:doctors:available:day:${day}`,
  DOCTORS_PAGINATED: (clinicId: string, search: string, page: number, limit: number) =>
    `clinic:${clinicId}:doctors:${search}:page:${page}:limit:${limit}`,
  DOCTOR_DASHBOARD: (doctorId: string, clinicId: string) => `doctor:${doctorId}:dashboard:clinic:${clinicId}`,
  TODAY_SCHEDULE: (clinicId: string) => `clinic:${clinicId}:schedule:today`,
  PATIENT_COUNT: (clinicId: string) => `clinic:${clinicId}:patient:count`,
  PATIENTS_PAGINATED: (clinicId: string, search: string, status: string, gender: string, page: number, limit: number) =>
    `clinic:${clinicId}:patients:${search}:${status}:${gender}:${page}:${limit}`,
  PATIENTS_RECENT: (clinicId: string, limit: number) => `clinic:${clinicId}:patients:recent:${limit}`,
  PATIENTS_BY_CLINIC: (clinicId: string) => `clinic:${clinicId}:patients`,
  PATIENTS_ALL: (clinicId: string) => `clinic:${clinicId}:patients:all`,
  PATIENT_GROWTH_CHART: (patientId: string, type: string) => `patient:${patientId}:chart:${type}`,
  PATIENT_APPOINTMENT: (patientId: string, appointmentId: string) =>
    `patient:${patientId}:appointment:${appointmentId}`,
  PATIENTS_SEARCH: (clinicId: string, query: string, searchBy: string) =>
    `clinic:${clinicId}:patients:search:${query}:${searchBy}`,
  APPOINTMENT_TODAY: (clinicId: string) => `clinic:${clinicId}:appointments:today`,
  APPOINTMENTS_MONTH: (clinicId: string, year: number, month: number) =>
    `clinic:${clinicId}:appointments:month:${year}:${month}`,
  // Clinic-specific collections with versioning
  CLINIC_GROWTH: (clinicId: string) => `clinic:${clinicId}:growth`,
  CLINIC_GROWTH_PAGINATED: (clinicId: string, page: number, limit: number) =>
    `clinic:${clinicId}:growth:page:${page}:limit:${limit}`,
  CLINIC_GROWTH_DATE_RANGE: (clinicId: string, fromDate: string, toDate: string) =>
    `clinic:${clinicId}:growth:from:${fromDate}:to:${toDate}`,
  CLINIC_GROWTH_STATS: (clinicId: string, fromDate?: string, toDate?: string) =>
    fromDate && toDate ? `clinic:${clinicId}:stats:from:${fromDate}:to:${toDate}` : `clinic:${clinicId}:stats`,
  CLINICS_USER: (userId: string) => `user:${userId}:clinics`,
  DASHBOARD_STATS: (clinicId: string, from: string, to: string) => `clinic:${clinicId}:dashboard:${from}:${to}`,

  MEDICAL_RECORDS_SUMMARY: (clinicId: string) => `clinic:${clinicId}:medical-records:summary`,
  RECENT_APPOINTMENTS: (clinicId: string, limit: number) => `clinic:${clinicId}:appointments:recent:${limit}`,
  UPCOMING_IMMUNIZATIONS: (clinicId: string) => `clinic:${clinicId}:immunizations:upcoming`,
  MONTHLY_PERFORMANCE: (clinicId: string) => `clinic:${clinicId}:performance:monthly`,
  PATIENT_STATS_BY_DOCTOR: (clinicId: string) => `clinic:${clinicId}:stats:patient-by-doctor`,
  PATIENT_REGISTRATION_TREND: (clinicId: string, period: string) =>
    `clinic:${clinicId}:stats:registration-trend:${period}`,

  MONTHLY_REPORT: (clinicId: string, year: number, month: number) => `clinic:${clinicId}:report:${year}:${month}`,
  SERVICES: (clinicId: string) => `clinic:${clinicId}:services`,
  SERVICE: (id: string) => `service:${id}`,
  STAFF: (clinicId: string) => `clinic:${clinicId}:staff`,
  DOCTORS: (clinicId: string) => `clinic:${clinicId}:doctors`,

  // WHO Standards
  WHO_STANDARDS: (gender: string, type: string, minAge?: number, maxAge?: number) =>
    `who:${gender}:${type}:${minAge || 0}:${maxAge || 240}`,

  GROWTH_STANDARD: (gender: string, type: string, ageDays: number) => `growth:standard:${gender}:${type}:${ageDays}`,
  DRUG: (id: string) => `drug:${id}`,
  // Version tags for bulk invalidation
  CLINIC_VERSION: (clinicId: string) => `clinic:${clinicId}:version`,
  PATIENT_VERSION: (patientId: string) => `patient:${patientId}:version`,

  // Cache tags for pattern-based invalidation
  TAGS: {
    PATIENT: (patientId: string) => `tag:patient:${patientId}`,
    CLINIC: (clinicId: string) => `tag:clinic:${clinicId}`,
    GROWTH: 'tag:growth',
    WHO: 'tag:who'
  },

  GROWTH_STANDARD_PATTERN: 'growth:standard:*',
  GROWTH_PERCENTILE_PATTERN: 'growth:percentile:*',
  DRUG_PATTERN: 'drug:*',
  DRUG_DOSAGE_PATTERN: 'drug:dosage:*',
  VACCINE_DUE_PATTERN: 'vaccine:due:*'
} as const;

export const CACHE_TTL = {
  VITAL_SIGNS: 60 * 60, // 1 hour
  PATIENT_IMMUNIZATIONS: 60 * 60, // 1 hour
  DRUG_DOSAGE: 60 * 60, // 1 hour
  IMMUNIZATION: 60 * 60, // 1 hour
  PATIENT_DUE_VACCINES: 60 * 60, // 1 hour
  VISIT: 60 * 5, // 5 minutes
  CLINIC_IMMUNIZATIONS: 60 * 60, // 1 hour
  VACCINE_SCHEDULE: 60 * 60, // 1 hour
  TODAY_VISITS: 60 * 5, // 5 minutes
  VISIT_LIST: 60 * 5, // 5 minutes
  LAB_TEST: 60 * 60, // 1 hour
  DIAGNOSIS: 60 * 60, // 1 hour
  MEDICAL_RECORD: 60 * 60, // 1 hour

  // Individual records - short TTL
  GROWTH_RECORD: 60 * 30, // 30 minutes
  DASHBOARD: 60 * 5, // 5 minutes
  DOCTOR: 60 * 60, // 1 hour
  GROWTH_PERCENTILE: 60 * 5, // 5 minutes

  SCHEDULE: 60 * 5, // 5 minutes
  PATIENTS_LIST: 60 * 5, // 5 minutes
  COUNT: 60 * 5, // 5 minutes
  SEARCH: 60 * 5, // 5 minutes
  PATIENT: 60 * 60, // 1 hour
  // Patient data - medium TTL
  PATIENT_GROWTH: 60 * 15, // 15 minutes
  PATIENT_LATEST: 60 * 10, // 10 minutes
  PATIENT_CHART: 60 * 30, // 30 minutes
  APPOINTMENT: 60 * 5, // 5 minutes
  APPOINTMENT_STATS: 60 * 15, // 15 minutes
  APPOINTMENT_STAT_RANGE: 60 * 15, // 15
  STATS: 60 * 15, // 15 minutes
  TREND: 60 * 60, // 1 hour
  CLINIC: 60 * 60, // 1 hour
  CLINIC_STATS: 60 * 15, // 15 minutes
  GENERAL_STATS: 60 * 15, // 15 minutes
  FEATURES: 60 * 60 * 24, // 1 day
  MEDICAL_RECORDS: 60 * 5, // 5 minutes
  IMMUNIZATIONS: 60 * 60, // 1 hour
  PERFORMANCE: 60 * 60, // 1 hour
  VACCINE_DUE: 60 * 60, // 1 hour
  // Clinic collections - short TTL to prevent stale data
  CLINIC_GROWTH: 60 * 5, // 5 minutes
  CLINIC_GROWTH_PAGINATED: 60 * 5, // 5 minutes
  SERVICES: 60 * 60, // 1 hour
  SERVICE: 60 * 60, // 1 hour
  STAFF: 60 * 60, // 1 hour
  DOCTORS: 60 * 60, // 1 hour

  // WHO standards - very long TTL (rarely changes)
  WHO_STANDARDS: 60 * 60 * 24 * 30, // 30 days

  GROWTH_STANDARD: 60 * 60 * 24 * 30, // 30 days
  DRUG: 60 * 60 * 24, // 1 day

  // Version keys - permanent (until explicitly updated)
  VERSION: null // no expiry
} as const;
