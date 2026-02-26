import logger from '@naroto/logger';

import { diagnosisRepo } from '..';
import prisma from '../client';
import { labTestRepo, medicalRecordRepo, prescriptionRepo, validationRepo, vitalSignsRepo } from '../repositories';
import { calculateAge } from '../utils';

export class PrescriptionService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async getPrescriptionsByMedicalRecord(
    medicalRecordId: string,
    clinicId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ) {
    try {
      // Get the medical record first to verify clinic access
      const medicalRecord = await medicalRecordRepo.findMedicalRecordById(this.db, medicalRecordId);
      if (!medicalRecord || medicalRecord.patient?.clinicId !== clinicId) {
        return [];
      }

      const prescriptions = await prescriptionRepo.findPrescriptionsByMedicalRecord(this.db, medicalRecordId, options);
      return prescriptions;
    } catch (error) {
      logger.error('Failed to get prescriptions by medical record', { error, medicalRecordId });
      throw new Error('Failed to retrieve prescriptions');
    }
  }

  async getPatientActivePrescriptions(patientId: string, clinicId: string) {
    try {
      // Validate patient exists
      const patient = await validationRepo.checkPatientExists(this.db, patientId, clinicId);
      if (!patient) {
        return [];
      }

      const prescriptions = await prescriptionRepo.findActivePrescriptionsByPatient(this.db, patientId, new Date());

      return prescriptions;
    } catch (error) {
      logger.error('Failed to get active prescriptions', { error, patientId });
      throw new Error('Failed to retrieve prescriptions');
    }
  }

  // ==================== COMPREHENSIVE PATIENT MEDICAL DATA ====================

  async getPatientMedicalSummary(patientId: string, clinicId: string) {
    try {
      // Validate patient exists
      const patient = await validationRepo.checkPatientExists(this.db, patientId, clinicId);
      if (!patient) {
        return null;
      }

      // Run queries in parallel
      const [diagnoses, medicalRecords, labTests, vitals, prescriptions] = await Promise.all([
        diagnosisRepo.findDiagnosesByPatient(this.db, patientId, { limit: 10 }),
        medicalRecordRepo.findMedicalRecordsByPatient(this.db, patientId, { limit: 5 }),
        labTestRepo.findLabTestsByPatient(this.db, patientId, { limit: 10 }),
        vitalSignsRepo.findVitalSignsByPatient(this.db, patientId, { limit: 20 }),
        prescriptionRepo.findActivePrescriptionsByPatient(this.db, patientId, new Date())
      ]);

      const summary = {
        patient: {
          id: patientId,
          age: patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null
        },
        stats: {
          totalDiagnoses: diagnoses.length,
          totalRecords: medicalRecords.length,
          totalLabTests: labTests.length,
          activePrescriptions: prescriptions.length
        },
        recentData: {
          diagnoses: diagnoses.slice(0, 3),
          labTests: labTests.slice(0, 3),
          vitals: vitals.slice(0, 5),
          upcomingAppointments: [] // Would be fetched from appointment service
        }
      };

      return summary;
    } catch (error) {
      logger.error('Failed to get patient medical summary', { error, patientId });
      throw new Error('Failed to retrieve medical summary');
    }
  }
}

export const prescriptionService = new PrescriptionService();
export default PrescriptionService;
