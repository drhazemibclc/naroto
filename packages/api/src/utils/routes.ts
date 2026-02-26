// Base route configuration
export const APP_ROUTES = {
  // Public routes
  HOME: '/',
  LOGIN: '/sign-in',
  REGISTER: '/sign-up',
  FORGOT_PASSWORD: '/forgot-password',
  ABOUT: '/about',
  CONTACT: '/contact',
  SERVICES: '/services',
  TESTIMONIALS: '/testimonials',
  HIPAA: '/hipaa',
  PRIVACY: '/privacy',
  TERMS: '/terms',

  // Protected Dashboard Routes
  DASHBOARD: {
    ROOT: '/dashboard',
    PATIENTS: '/dashboard/patients',
    PATIENT_DETAIL: (id: string) => `/dashboard/patients/${id}`,
    PATIENT_OVERVIEW: (id: string) => `/dashboard/patients/${id}`,
    PATIENT_APPOINTMENTS: (id: string) => `/dashboard/patients/${id}/appointments`,
    PATIENT_MEDICAL_RECORDS: (id: string) => `/dashboard/patients/${id}/medical-records`,
    PATIENT_GROWTH: (id: string) => `/dashboard/patients/${id}/growth`,
    PATIENT_IMMUNIZATIONS: (id: string) => `/dashboard/patients/${id}/immunizations`,
    PATIENT_BILLING: (id: string) => `/dashboard/patients/${id}/billing`,
    PATIENT_VITALS: (id: string) => `/dashboard/patients/${id}/vitals`,

    DOCTORS: '/dashboard/doctors',
    DOCTOR_DETAIL: (id: string) => `/dashboard/doctors/${id}`,

    APPOINTMENTS: '/dashboard/appointments',
    APPOINTMENT_DETAIL: (id: string) => `/dashboard/appointments/${id}/view`,
    APPOINTMENT_SCHEDULE: '/dashboard/appointments/schedule',

    MEDICAL_RECORDS: '/dashboard/medical-records',
    BILLING: '/dashboard/billing',

    CLINIC: '/dashboard/clinic',
    CLINIC_SETTINGS: '/dashboard/clinic/settings',

    STAFF: '/dashboard/staff',

    ANALYTICS: {
      ROOT: '/dashboard/analytics',
      OVERVIEW: '/dashboard/analytics/overview',
      FINANCIAL: '/dashboard/analytics/financial',
      GROWTH_CHARTS: '/dashboard/analytics/growth-charts',
      IMMUNIZATION: '/dashboard/analytics/immunization'
    },

    NOTIFICATIONS: '/dashboard/notifications',
    PROFILE: '/dashboard/profile',
    ACCOUNT: '/dashboard/account'
  },

  // Record Routes (Admin/Management)
  RECORD: {
    ROOT: '/record',
    APPOINTMENTS: '/record/appointments',
    APPOINTMENT_DETAIL: (id: string) => `/record/appointments/${id}`,
    BILLING: '/record/billing',
    DOCTORS: '/record/doctors',
    DOCTOR_DETAIL: (id: string) => `/record/doctors/${id}`,
    MEDICAL_RECORDS: '/record/medical-records',
    PATIENTS: '/record/patients',
    PATIENT_DETAIL: (id: string) => `/record/patients/${id}`,
    STAFF: '/record/staff',
    USERS: '/record/users'
  },

  // Admin Routes
  ADMIN: {
    ROOT: '/admin',
    SYSTEM_SETTINGS: '/admin/system-settings',
    USERS: '/admin/users'
  },

  // API Routes
  API: {
    AUTH: '/api/auth',
    TRPC: '/api/trpc',
    UPLOAD: '/api/upload',
    UPLOAD_FILE: '/api/upload-file',
    FILES: '/api/files'
  }
} as const;

export const AUTH_ROUTES = {
  LOGIN: APP_ROUTES.LOGIN,
  SIGNUP: APP_ROUTES.REGISTER,
  FORGOT_PASSWORD: APP_ROUTES.FORGOT_PASSWORD,
  /** Where to redirect after successful authentication */
  DASHBOARD: APP_ROUTES.HOME
} as const;
