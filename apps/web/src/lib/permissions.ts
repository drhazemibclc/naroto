// lib/permissions.ts
export const PERMISSIONS = {
  PATIENTS: {
    CREATE: { patients: ['create'] },
    READ: { patients: ['read'] },
    UPDATE: { patients: ['update'] },
    DELETE: { patients: ['delete'] },
    LIST: { patients: ['list'] }
  },
  APPOINTMENTS: {
    CREATE: { appointments: ['create'] },
    READ: { appointments: ['read'] },
    UPDATE: { appointments: ['update'] },
    DELETE: { appointments: ['delete'] },
    LIST: { appointments: ['list'] }
  },
  RECORDS: {
    CREATE: { records: ['create'] },
    READ: { records: ['read'] },
    UPDATE: { records: ['update'] },
    DELETE: { records: ['delete'] },
    LIST: { records: ['list'] }
  },
  STAFF: {
    CREATE: { staff: ['create'] },
    READ: { staff: ['read'] },
    UPDATE: { staff: ['update'] },
    DELETE: { staff: ['delete'] },
    LIST: { staff: ['list'] }
  },
  PAYMENTS: {
    CREATE: { payments: ['create'] },
    READ: { payments: ['read'] },
    UPDATE: { payments: ['update'] },
    DELETE: { payments: ['delete'] },
    LIST: { payments: ['list'] }
  },
  IMMUNIZATION: {
    CREATE: { immunization: ['create'] },
    READ: { immunization: ['read'] },
    UPDATE: { immunization: ['update'] },
    DELETE: { immunization: ['delete'] }
  },
  PRESCRIPTION: {
    CREATE: { prescription: ['create'] },
    READ: { prescription: ['read'] },
    UPDATE: { prescription: ['update'] },
    DELETE: { prescription: ['delete'] }
  },
  GROWTH: {
    CREATE: { growth: ['create'] },
    READ: { growth: ['read'] },
    UPDATE: { growth: ['update'] },
    DELETE: { growth: ['delete'] }
  },
  SYSTEM: {
    BACKUP: { system: ['backup'] },
    RESTORE: { system: ['restore'] },
    CONFIGURE: { system: ['configure'] }
  },
  REPORTS: {
    GENERATE: { reports: ['generate'] },
    EXPORT: { reports: ['export'] },
    VIEW: { reports: ['view'] }
  }
} as const;
