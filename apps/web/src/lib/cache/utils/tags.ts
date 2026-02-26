/**
 * 🏷️ Hierarchical Cache Tags
 * Following BEST_PRACTICES.md - Hierarchical structure for precise invalidation
 */
export const CACHE_TAGS = {
  clinicDashboard: (clinicId: string) => `clinic-${clinicId}-dashboard`,
  clinicStats: (clinicId: string) => `clinic-${clinicId}-stats`,
  clinicSettings: (clinicId: string) => `clinic-${clinicId}-settings`,

  // ==================== CLINIC ====================
  clinic: {
    all: 'clinics:all',
    byId: (id: string) => `clinic:${id}`,
    stats: 'clinic:stats:global',
    dashboard: (clinicId: string) => `clinic:${clinicId}:dashboard`,
    counts: (clinicId: string) => `clinic:${clinicId}:counts`,
    settings: (clinicId: string) => `clinic:${clinicId}:settings`,
    features: (clinicId: string) => `clinic:${clinicId}:features`,
    members: (clinicId: string) => `clinic:${clinicId}:members`,
    activity: (clinicId: string) => `clinic:${clinicId}:activity`
  },
  patients: (clinicId: string) => `clinic-${clinicId}-patients`,
  patientMedicalRecords: (patientId: string) => `patient-${patientId}-medical-records`,
  patientMeasurements: (patientId: string) => `patient-${patientId}-measurements`,
  patientPrescriptions: (patientId: string) => `patient-${patientId}-prescriptions`,

  // Doctor tags
  doctors: (clinicId: string) => `clinic-${clinicId}-doctors`,
  doctorSchedule: (doctorId: string) => `doctor-${doctorId}-schedule`,
  doctorAppointments: (doctorId: string) => `doctor-${doctorId}-appointments`,

  // Staff tags
  staffList: (clinicId: string) => `clinic-${clinicId}-staff`,

  // Service tags
  services: (clinicId: string) => `clinic-${clinicId}-services`,

  // Appointment tags
  appointments: (clinicId: string) => `clinic-${clinicId}-appointments`,
  appointmentsByDoctor: (doctorId: string) => `doctor-${doctorId}-appointments`,

  // Medical Record tags
  medicalRecords: (patientId: string) => `patient-${patientId}-records`,
  medicalRecord: (recordId: string) => `medical-record-${recordId}`,

  // Prescription tags
  prescriptions: (patientId: string) => `patient-${patientId}-prescriptions`,
  prescription: (prescriptionId: string) => `prescription-${prescriptionId}`,

  // ==================== WORKING DAYS ====================
  workingDays: {
    byClinic: (clinicId: string) => `working-days:clinic:${clinicId}`,
    byDoctor: (doctorId: string) => `working-days:doctor:${doctorId}`
  },

  // ==================== PATIENT ====================
  patient: {
    all: 'patients:all',
    byId: (id: string) => `patient:${id}`,
    byClinic: (clinicId: string) => `patients:clinic:${clinicId}`,
    recent: (clinicId: string) => `patients:recent:${clinicId}`,
    infants: (clinicId: string) => `patients:infants:${clinicId}`,
    dashboard: (clinicId: string) => `dashboard:patients:${clinicId}`,
    // Nested resources
    appointments: (patientId: string) => `patient:${patientId}:appointments`,
    records: (patientId: string) => `patient:${patientId}:medical-records`,
    billing: (patientId: string) => `patient:${patientId}:billing`,
    growth: (patientId: string) => `patient:${patientId}:growth`,
    immunizations: (patientId: string) => `patient:${patientId}:immunizations`,
    vitalSigns: (patientId: string) => `patient:${patientId}:vitals`,
    prescriptions: (patientId: string) => `patient:${patientId}:prescriptions`,
    guardians: (patientId: string) => `patient:${patientId}:guardians`
  },

  // ==================== DOCTOR ====================
  doctor: {
    all: 'doctors:all',
    byId: (id: string) => `doctor:${id}`,
    byClinic: (clinicId: string) => `doctors:clinic:${clinicId}`,
    bySpecialty: (specialty: string, clinicId: string) => `doctors:specialty:${specialty}:clinic:${clinicId}`,
    // Nested resources
    workingDays: (doctorId: string) => `doctor:${doctorId}:working-days`,
    appointments: (doctorId: string) => `doctor:${doctorId}:appointments`,
    performance: (doctorId: string) => `doctor:${doctorId}:performance`,
    ratings: (doctorId: string) => `doctor:${doctorId}:ratings`
  },

  // ==================== VISIT ====================
  visit: {
    all: 'visits:all',
    byId: (id: string) => `visit:${id}`,
    byPatient: (patientId: string) => `visits:patient:${patientId}`,
    byDoctor: (doctorId: string) => `visits:doctor:${doctorId}`,
    byClinic: (clinicId: string) => `visits:clinic:${clinicId}`,
    recent: (clinicId: string) => `visits:recent:${clinicId}`,
    today: (clinicId: string) => `visits:today:${clinicId}`,
    upcoming: (clinicId: string) => `visits:upcoming:${clinicId}`,
    counts: (clinicId: string) => `visits:counts:${clinicId}`,
    month: (clinicId: string, monthKey: string) => `visits:month:${clinicId}:${monthKey}`,
    byStatus: (clinicId: string, status: string) => `visits:status:${clinicId}:${status}`,
    doctorSchedule: (doctorId: string, dateKey: string) => `visits:schedule:${doctorId}:${dateKey}`,
    dashboard: (clinicId: string) => `visits:dashboard:${clinicId}`
  },

  // ==================== STAFF ====================
  staff: {
    all: 'staff:all',
    byId: (id: string) => `staff:${id}`,
    byClinic: (clinicId: string) => `staff:clinic:${clinicId}`,
    byDepartment: (department: string, clinicId: string) => `staff:department:${department}:clinic:${clinicId}`
  },

  // ==================== APPOINTMENT ====================
  appointment: {
    all: 'appointments:all',
    byId: (id: string) => `appointment:${id}`,
    byClinic: (clinicId: string) => `appointments:clinic:${clinicId}`,
    byPatient: (patientId: string) => `appointments:patient:${patientId}`,
    byDoctor: (doctorId: string) => `appointments:doctor:${doctorId}`,
    byDate: (date: string) => `appointments:date:${date}`,
    byDateRange: (from: string, to: string) => `appointments:range:${from}:${to}`,
    today: (clinicId: string) => `appointments:today:${clinicId}`,
    upcoming: (clinicId: string) => `appointments:upcoming:${clinicId}`,
    past: (clinicId: string) => `appointments:past:${clinicId}`,
    byStatus: (status: string, clinicId: string) => `appointments:status:${status}:clinic:${clinicId}`
  },

  // ==================== SERVICE ====================
  service: {
    all: 'services:all',
    stats: (clinicId: string) => `services:stats:${clinicId}`,
    filtered: (filters: Record<string, unknown>) => `services:filtered:${JSON.stringify(filters)}`,
    byId: (id: string) => `service:${id}`,
    byClinic: (clinicId: string) => `services:clinic:${clinicId}`,
    byCategory: (category: string, clinicId: string) => `services:category:${category}:clinic:${clinicId}`,
    available: (clinicId: string) => `services:available:clinic:${clinicId}`
  },

  // ==================== GROWTH ====================
  growth: {
    // Basic
    byId: (id: string) => `growth:${id}`,
    byPatient: (patientId: string) => `growth:patient:${patientId}`,
    byClinic: (clinicId: string) => `growth:clinic:${clinicId}`,
    recentByClinic: (clinicId: string) => `growth:recent:clinic:${clinicId}`,
    patientAllGrowth: (patientId: string) => `growth:patient:${patientId}:all`,

    // Calculations
    percentileByPatient: (patientId: string) => `growth:percentile:patient:${patientId}`,
    trendsByPatient: (patientId: string) => `growth:trends:patient:${patientId}`,
    velocityByPatient: (patientId: string) => `growth:velocity:patient:${patientId}`,
    comparisonByPatient: (patientId: string) => `growth:comparison:patient:${patientId}`,
    projectionByPatient: (patientId: string) => `growth:projection:patient:${patientId}`,
    summaryByPatient: (patientId: string) => `growth:summary:patient:${patientId}`,

    // WHO Standards
    standards: 'growth:who:standards',
    standardsMap: 'growth:who:map',
    standardsByGender: (gender: string) => `growth:who:gender:${gender}`,
    standardsByType: (type: string) => `growth:who:type:${type}`,
    standardsByAge: (ageDays: number) => `growth:who:age:${ageDays}`,
    standardsInterpolation: (ageDays: number) => `growth:who:interp:${ageDays}`,

    // Z-Scores
    zScore: (gender: string, ageDays: number) => `growth:zscore:${gender}:${ageDays}`,
    zScoreByGender: (gender: string) => `growth:zscore:gender:${gender}`,
    batchZScores: (hash: string) => `growth:zscore:batch:${hash}`,

    // Charts
    chartData: (gender: string, type: string) => `growth:chart:${gender}:${type}`,
    patientChartData: (patientId: string, type: string) => `growth:chart:patient:${patientId}:${type}`,

    // Overview
    overviewByClinic: (clinicId: string) => `growth:overview:clinic:${clinicId}`,

    // Keep these for backward compatibility
    whoAll: 'growth:who:all',
    whoByGender: (gender: string) => `growth:who:gender:${gender}`,
    whoByType: (type: string) => `growth:who:type:${type}`,
    whoByAge: (ageDays: number) => `growth:who:age:${ageDays}`,
    whoInterpolation: (ageDays: number) => `growth:who:interp:${ageDays}`
  },

  // ==================== VACCINATION ====================
  vaccination: {
    all: 'vaccinations:all',
    byName: (name: string) => `vaccination:name:${name}`,
    byId: (id: string) => `vaccination:${id}`,
    scheduleByAge: (ageMonth: number) => `vaccinations:schedule:${ageMonth}`,
    schedule: 'vaccinations:schedule',
    counts: (clinicId: string) => `vaccinations:counts:${clinicId}`,
    byStatus: (clinicId: string, status: string) => `vaccinations:status:${status}:clinic:${clinicId}`,
    byPatient: (patientId: string) => `vaccinations:patient:${patientId}`,
    byClinic: (clinicId: string) => `vaccinations:clinic:${clinicId}`,
    upcoming: (clinicId: string) => `vaccinations:upcoming:${clinicId}`,
    scheduled: (clinicId: string) => `vaccinations:scheduled:${clinicId}`,
    dashboard: (clinicId: string) => `dashboard:vaccinations:${clinicId}`
  },

  // ==================== MEDICAL ====================
  medical: {
    record: {
      countByClinic: (clinicId: string) => `medical-records:count:clinic:${clinicId}`,
      byId: (id: string) => `medical-record:${id}`,
      byClinic: (clinicId: string) => `medical-records:clinic:${clinicId}`,
      byPatient: (patientId: string) => `medical-records:patient:${patientId}`,
      byAppointment: (appointmentId: string) => `medical-records:appointment:${appointmentId}`
    },
    diagnosis: {
      byId: (id: string) => `diagnosis:${id}`,
      byAppointment: (appointmentId: string) => `diagnoses:appointment:${appointmentId}`,
      byMedicalRecord: (medicalRecordId: string) => `diagnoses:medical-record:${medicalRecordId}`,
      byPatient: (patientId: string) => `diagnoses:patient:${patientId}`,
      byDoctor: (doctorId: string) => `diagnoses:doctor:${doctorId}`,
      byClinic: (clinicId: string) => `diagnoses:clinic:${clinicId}`
    },
    vitalSigns: {
      byId: (id: string) => `vital-signs:${id}`,
      byMedicalRecord: (medicalId: string) => `medical:vital:medical:${medicalId}`,
      byPatient: (patientId: string) => `medical:vital:patient:${patientId}`,
      latestByPatient: (patientId: string) => `medical:vital:patient:${patientId}:latest`,
      byEncounter: (encounterId: string) => `vital-signs:encounter:${encounterId}`
    },
    immunization: {
      byId: (id: string) => `immunization:${id}`,
      byClinic: (clinicId: string) => `immunizations:clinic:${clinicId}`,
      byPatient: (patientId: string) => `immunizations:patient:${patientId}`,
      byVaccine: (vaccine: string) => `immunizations:vaccine:${vaccine}`
    },
    prescription: {
      byId: (id: string) => `prescription:${id}`,
      byPatient: (patientId: string) => `prescriptions:patient:${patientId}`,
      byMedicalRecord: (medicalRecordId: string) => `prescriptions:medical-record:${medicalRecordId}`,
      byDoctor: (doctorId: string) => `prescriptions:doctor:${doctorId}`,
      active: (patientId: string) => `prescriptions:active:${patientId}`
    },
    lab: {
      byId: (id: string) => `lab-test:${id}`,
      byMedicalRecord: (medicalId: string) => `medical:lab:medical:${medicalId}`,
      byPatient: (patientId: string) => `lab-tests:patient:${patientId}`,
      byService: (serviceId: string) => `lab-tests:service:${serviceId}`,
      byClinic: (clinicId: string) => `lab-tests:clinic:${clinicId}`
    }
  },

  // ==================== FINANCIAL ====================
  financial: {
    payment: {
      byId: (id: string) => `payment:${id}`,
      byPatient: (patientId: string) => `payments:patient:${patientId}`,
      byClinic: (clinicId: string) => `payments:clinic:${clinicId}`,
      byStatus: (status: string, clinicId: string) => `payments:status:${status}:clinic:${clinicId}`
    },
    bill: {
      byId: (id: string) => `bill:${id}`,
      byPatient: (patientId: string) => `bills:patient:${patientId}`,
      byPayment: (paymentId: string) => `bills:payment:${paymentId}`
    },
    expense: {
      byId: (id: string) => `expense:${id}`,
      byClinic: (clinicId: string) => `expenses:clinic:${clinicId}`,
      byCategory: (categoryId: string) => `expenses:category:${categoryId}`,
      byDate: (date: string) => `expenses:date:${date}`
    }
  },

  // ==================== ADMIN ====================
  admin: {
    dashboard: (clinicId: string) => `admin:dashboard:${clinicId}`,
    activity: (userId: string) => `admin:activity:${userId}`,
    activityByClinic: (clinicId: string) => `admin:activity:clinic:${clinicId}`,
    reports: (clinicId: string, reportType: string) => `admin:reports:${reportType}:clinic:${clinicId}`
  },

  // ==================== SYSTEM ====================
  system: {
    settings: 'system:settings',
    whoStandards: 'system:who-standards',
    whoByAge: (gender: string, chartType: string, ageDays: number) => `system:who:${gender}:${chartType}:${ageDays}`,
    drugs: 'system:drugs',
    vaccineSchedule: 'system:vaccine-schedule'
  },

  // ==================== DRUG ====================
  drug: {
    all: 'drugs:all',
    byId: (id: string) => `drug:${id}`,
    byName: (name: string) => `drug:name:${name}`,
    search: (query: string) => `drugs:search:${query}`,
    guidelines: (drugId: string) => `drug:${drugId}:guidelines`
  },

  // ==================== USER ====================
  user: {
    byId: (id: string) => `user:${id}`,
    byEmail: (email: string) => `user:email:${email}`,
    notifications: (userId: string) => `user:${userId}:notifications`,
    savedFilters: (userId: string, clinicId: string) => `user:${userId}:filters:clinic:${clinicId}`,
    current: 'user:current'
  }
} as const;

// Type helper
export type CacheTag =
  | ReturnType<typeof CACHE_TAGS.clinic.byId>
  | ReturnType<typeof CACHE_TAGS.patient.byId>
  | ReturnType<typeof CACHE_TAGS.doctor.byId>
  | ReturnType<typeof CACHE_TAGS.visit.byId>
  | ReturnType<typeof CACHE_TAGS.appointment.byId>
  | ReturnType<typeof CACHE_TAGS.growth.byId>
  | ReturnType<typeof CACHE_TAGS.vaccination.byId>
  | ReturnType<typeof CACHE_TAGS.medical.record.byId>
  | ReturnType<typeof CACHE_TAGS.medical.diagnosis.byId>
  | ReturnType<typeof CACHE_TAGS.medical.vitalSigns.byId>
  | ReturnType<typeof CACHE_TAGS.medical.immunization.byId>
  | ReturnType<typeof CACHE_TAGS.medical.prescription.byId>
  | ReturnType<typeof CACHE_TAGS.medical.lab.byId>
  | ReturnType<typeof CACHE_TAGS.financial.payment.byId>
  | ReturnType<typeof CACHE_TAGS.financial.bill.byId>
  | ReturnType<typeof CACHE_TAGS.financial.expense.byId>
  | ReturnType<typeof CACHE_TAGS.drug.byId>
  | ReturnType<typeof CACHE_TAGS.user.byId>
  | (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS][keyof (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS]];
export const cacheTags = CACHE_TAGS;
