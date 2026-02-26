export * from '../generated/client';
// src/index.ts
// Client
export { prisma } from './client';
// Constants
// Errors
export { ApiError, ValidationError } from './error';
// Repositories
export * from './repositories';
export * as diagnosisRepo from './repositories/diagnosis.repo';
export * as labTestRepo from './repositories/lab-test.repo';
export * as medicalRecordRepo from './repositories/medical-record.repo';
export * as prescriptionRepo from './repositories/prescription.repo';
export * as validationRepo from './repositories/validation.repo';
export * as vitalSignsRepo from './repositories/vital-signs.repo';
export { appointmentAvailability } from './services/appointment/availability';
export type { TimeSlot } from './services/appointment/availability';
// Services
export { growthCalculator } from './services/growth/calculator';
export { immunizationService } from './services/immunization/due-calculator';
// Export services (preferred way to interact with data)
export { MedicalService, medicalService } from './services/medical.service';
// Types
// Utilities
export { ageCalculator } from './utils/date/age';
export { decimalUtils } from './utils/number/decimal';
export { doseValidator } from './utils/validation/dose';
