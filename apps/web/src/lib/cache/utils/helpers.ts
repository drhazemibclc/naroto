/**
 * 🛠️ Type-Safe Cache Helpers
 * Following BEST_PRACTICES.md - Prevent cache invalidation bugs
 * Next.js 16+ requires profile parameter for revalidateTag
 */
import { revalidateTag, updateTag } from 'next/cache';

import type { CacheProfile } from './profiles';
import { CACHE_TAGS } from './tags';

/**
 * Default cache profile for revalidation
 * Using 'hours' as default since it's a built-in profile in Next.js 16+
 */
const DEFAULT_REVALIDATE_PROFILE = 'hours' as const;
// const DEFAULT_PROFILE = 'medicalShort' as CacheProfile;
/**
 * Helper to safely call revalidateTag with required profile
 */
function revalidateWithProfile(tag: string, profile: CacheProfile | string = DEFAULT_REVALIDATE_PROFILE) {
  // Use built-in profile string for Next.js built-in profiles
  // Or use our custom profiles from CACHE_PROFILES
  revalidateTag(tag, profile);
}

export const cacheHelpers = {
  // ==================== CLINIC ====================
  clinic: {
    invalidate(id: string) {
      revalidateWithProfile(CACHE_TAGS.clinic.byId(id), 'seconds');
      revalidateWithProfile(CACHE_TAGS.clinic.all, 'hours');
    },

    invalidateDashboard(clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.clinic.counts(clinicId), 'minutes');
    },

    invalidateSettings(clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.clinic.settings(clinicId), 'minutes');
    },

    invalidateAll() {
      revalidateWithProfile(CACHE_TAGS.clinic.all, 'hours');
    }
  },

  // ==================== PATIENT ====================
  patient: {
    invalidate: (id: string, clinicId: string, profile: CacheProfile = 'medicalShort') => {
      revalidateWithProfile(CACHE_TAGS.patient.byId(id), 'seconds');
      revalidateTag(CACHE_TAGS.patient.recent(clinicId), profile);
      revalidateTag(CACHE_TAGS.patient.dashboard(clinicId), profile);
      revalidateWithProfile(CACHE_TAGS.patient.byClinic(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.patient.all, 'hours');
    },

    invalidateClinic(clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.patient.byClinic(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.clinic.counts(clinicId), 'minutes');
    },

    invalidateAppointments(patientId: string, clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.patient.appointments(patientId), 'seconds');
      revalidateWithProfile(CACHE_TAGS.appointment.byPatient(patientId), 'seconds');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
    },

    invalidateMedical(patientId: string, clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.patient.records(patientId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.medical.record.byPatient(patientId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.patient.byClinic(clinicId), 'minutes');
    },
    invalidateVitals(patientId: string, clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.patient.vitalSigns(patientId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.medical.vitalSigns.byPatient(patientId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
    },
    invalidatePrescriptions(patientId: string, clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.patient.prescriptions(patientId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.medical.prescription.byPatient(patientId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.medical.prescription.active(patientId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
    },
    invalidatePatientLabTests(patientId: string, clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.medical.lab.byPatient(patientId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.patient.records(patientId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
    },
    invalidateBilling(patientId: string, clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.patient.billing(patientId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.financial.payment.byPatient(patientId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.financial.bill.byPatient(patientId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
    },
    invalidateInfants: (clinicId: string) => {
      revalidateWithProfile(CACHE_TAGS.patient.infants(clinicId), 'minutes');
    },
    update: (id: string, clinicId: string) => {
      updateTag(CACHE_TAGS.patient.byId(id));
      updateTag(CACHE_TAGS.patient.byClinic(clinicId));
      updateTag(CACHE_TAGS.patient.recent(clinicId));
      updateTag(CACHE_TAGS.patient.dashboard(clinicId));
    },
    invalidateAll() {
      revalidateWithProfile(CACHE_TAGS.patient.all, 'hours');
    }
  },

  // ==================== DOCTOR ====================
  doctor: {
    invalidate(id: string, clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.doctor.byId(id), 'seconds');
      revalidateWithProfile(CACHE_TAGS.doctor.byClinic(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.doctor.all, 'hours');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
    },
    /**
     * Invalidate doctor ratings and related statistical views
     */
    invalidateRating(doctorId: string, clinicId: string) {
      // Immediate update for the specific doctor's profile/rating component
      revalidateWithProfile(CACHE_TAGS.doctor.byId(doctorId), 'seconds');

      // Update the clinic-wide doctor list (which likely shows star ratings)
      revalidateWithProfile(CACHE_TAGS.doctor.byClinic(clinicId), 'minutes');

      // If the dashboard shows "Top Rated Doctors" or "Recent Feedback"
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');

      // Optional: If you have a global or clinic-specific reviews tag
      // revalidateWithProfile(CACHE_TAGS.doctor.reviews(doctorId), 'seconds');
    },
    invalidateClinic(clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.doctor.byClinic(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.clinic.counts(clinicId), 'minutes');
    },

    invalidateWorkingDays(doctorId: string, clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.doctor.byClinic(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.doctor.workingDays(doctorId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.doctor.byId(doctorId), 'seconds');
    },

    invalidateAppointments(doctorId: string, clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.doctor.appointments(doctorId), 'seconds');
      revalidateWithProfile(CACHE_TAGS.appointment.byDoctor(doctorId), 'seconds');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
    }
  },
  visit: {
    invalidate(id: string, patientId: string, clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.visit.byId(id), 'seconds');
      revalidateWithProfile(CACHE_TAGS.visit.byPatient(patientId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.visit.byClinic(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.patient.appointments(patientId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
    },

    invalidateDashboard(clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.visit.recent(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.visit.today(clinicId), 'seconds');
      revalidateWithProfile(CACHE_TAGS.visit.upcoming(clinicId), 'seconds');
      revalidateWithProfile(CACHE_TAGS.visit.counts(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.visit.dashboard(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
    },

    invalidateDoctorSchedule(doctorId: string, clinicId: string) {
      const todayKey = new Date().toISOString().split('T')[0] ?? new Date().toISOString().slice(0, 10);
      revalidateWithProfile(CACHE_TAGS.visit.doctorSchedule(doctorId, todayKey), 'seconds');
      revalidateWithProfile(CACHE_TAGS.visit.byDoctor(doctorId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.visit.byClinic(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
    },

    invalidateCompleted(patientId: string, clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.visit.byPatient(patientId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.patient.appointments(patientId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
    },

    invalidateMonth(clinicId: string) {
      const monthKey = new Date().toISOString().slice(0, 7);
      revalidateWithProfile(CACHE_TAGS.visit.month(clinicId, monthKey), 'minutes');
      revalidateWithProfile(CACHE_TAGS.visit.counts(clinicId), 'minutes');
    }
  },
  vaccination: {
    invalidate: (id: string, patientId: string, clinicId: string) => {
      revalidateWithProfile(CACHE_TAGS.vaccination.byId(id), 'minutes');
      revalidateWithProfile(CACHE_TAGS.vaccination.byPatient(patientId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.vaccination.byClinic(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.vaccination.upcoming(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.vaccination.dashboard(clinicId), 'minutes');
    },
    invalidatePatientSchedule(patientId: string, clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.vaccination.byPatient(patientId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.vaccination.upcoming(clinicId), 'minutes');
    },
    invalidateUpcoming: (clinicId: string) => {
      revalidateWithProfile(CACHE_TAGS.vaccination.upcoming(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.vaccination.dashboard(clinicId), 'minutes');
    }
  },

  // ============ DASHBOARD ============
  dashboard: {
    invalidateAll: (clinicId: string) => {
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'seconds');
      revalidateWithProfile(CACHE_TAGS.patient.dashboard(clinicId), 'seconds');
      revalidateWithProfile(CACHE_TAGS.visit.dashboard(clinicId), 'seconds');
      revalidateWithProfile(CACHE_TAGS.vaccination.dashboard(clinicId), 'seconds');
    }
  },
  // ==================== STAFF ====================
  staff: {
    invalidate(id: string, clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.staff.byId(id), 'seconds');
      revalidateWithProfile(CACHE_TAGS.staff.byClinic(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.staff.all, 'hours');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
    },

    invalidateClinic(clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.staff.byClinic(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.clinic.counts(clinicId), 'minutes');
    }
  },

  // ==================== APPOINTMENT ====================
  appointment: {
    invalidate(
      id: string,
      data: {
        patientId: string;
        doctorId: string;
        clinicId: string;
        date: Date;
      }
    ) {
      const dateStr = data.date.toISOString().split('T')[0];

      revalidateWithProfile(CACHE_TAGS.appointment.byId(id), 'seconds');
      revalidateWithProfile(CACHE_TAGS.appointment.byPatient(data.patientId), 'seconds');
      revalidateWithProfile(CACHE_TAGS.appointment.byDoctor(data.doctorId), 'seconds');
      revalidateWithProfile(CACHE_TAGS.appointment.byClinic(data.clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.appointment.byDate(dateStr ?? ''), 'seconds');
      revalidateWithProfile(CACHE_TAGS.appointment.today(data.clinicId), 'seconds');

      // Related entities
      revalidateWithProfile(CACHE_TAGS.patient.appointments(data.patientId), 'seconds');
      revalidateWithProfile(CACHE_TAGS.doctor.appointments(data.doctorId), 'seconds');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(data.clinicId), 'minutes');
    },

    invalidateToday(clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.appointment.today(clinicId), 'seconds');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
    },

    invalidateClinic(clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.appointment.byClinic(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.appointment.today(clinicId), 'seconds');
      revalidateWithProfile(CACHE_TAGS.appointment.upcoming(clinicId), 'minutes');
    }
  },

  // ==================== SERVICE ====================
  service: {
    invalidate(id: string, clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.service.byId(id), 'seconds');
      revalidateWithProfile(CACHE_TAGS.service.byClinic(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.service.all, 'hours');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
    },

    invalidateClinic(clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.service.byClinic(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.service.available(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
    }
  },

  // ==================== MEDICAL ====================
  medical: {
    record: {
      invalidatePatientRecords(patientId: string, clinicId: string) {
        revalidateWithProfile(CACHE_TAGS.medical.record.byPatient(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.medical.record.byClinic(clinicId), 'minutes');
      },
      invalidate(id: string, patientId: string) {
        revalidateWithProfile(CACHE_TAGS.medical.record.byId(id), 'minutes');
        revalidateWithProfile(CACHE_TAGS.medical.record.byPatient(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.patient.byId(id), 'minutes');
        revalidateWithProfile(CACHE_TAGS.patient.records(patientId), 'minutes');
      }
    },

    diagnosis: {
      invalidatePatientDiagnosis(patientId: string) {
        revalidateWithProfile(CACHE_TAGS.medical.diagnosis.byPatient(patientId), 'minutes');
      },
      invalidateByMedicalRecord(id: string) {
        revalidateWithProfile(CACHE_TAGS.medical.diagnosis.byId(id), 'minutes');
      },
      invalidateByAppointment(appointmentId: string) {
        revalidateWithProfile(CACHE_TAGS.medical.diagnosis.byAppointment(appointmentId), 'minutes');
      },
      invalidateByDoctor(doctorId: string) {
        revalidateWithProfile(CACHE_TAGS.medical.diagnosis.byDoctor(doctorId), 'minutes');
      },
      invalidateByClinic(clinicId: string) {
        revalidateWithProfile(CACHE_TAGS.medical.diagnosis.byClinic(clinicId), 'minutes');
      },
      invalidate(id: string, patientId: string, doctorId: string) {
        revalidateWithProfile(CACHE_TAGS.medical.diagnosis.byId(id), 'minutes');
        revalidateWithProfile(CACHE_TAGS.medical.diagnosis.byPatient(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.medical.diagnosis.byDoctor(doctorId), 'minutes');
      }
    },

    vitalSigns: {
      invalidate(id: string, patientId: string) {
        revalidateWithProfile(CACHE_TAGS.medical.vitalSigns.byId(id), 'seconds');
        revalidateWithProfile(CACHE_TAGS.medical.vitalSigns.byPatient(patientId), 'seconds');
        revalidateWithProfile(CACHE_TAGS.patient.vitalSigns(patientId), 'seconds');
      }
    },
    growth: {
      invalidateGrowthRecord(id: string, patientId: string, clinicId: string) {
        revalidateWithProfile(CACHE_TAGS.growth.byId(id), 'seconds');
        revalidateWithProfile(CACHE_TAGS.growth.byPatient(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.growth.patientAllGrowth(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.patient.growth(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
      },

      invalidatePatientGrowth(patientId: string, clinicId: string) {
        revalidateWithProfile(CACHE_TAGS.growth.byPatient(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.growth.percentileByPatient(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.growth.trendsByPatient(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.growth.velocityByPatient(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.growth.comparisonByPatient(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.growth.projectionByPatient(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.growth.summaryByPatient(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.growth.patientAllGrowth(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.growth.patientChartData(patientId, '*'), 'minutes');
        revalidateWithProfile(CACHE_TAGS.patient.growth(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.patient.growth(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
      },

      invalidateClinicGrowth(clinicId: string) {
        revalidateWithProfile(CACHE_TAGS.growth.byClinic(clinicId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.growth.recentByClinic(clinicId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.growth.overviewByClinic(clinicId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
      },

      invalidateWHOStandards() {
        revalidateWithProfile(CACHE_TAGS.growth.standards, 'days');
        revalidateWithProfile(CACHE_TAGS.growth.standardsMap, 'days');
      }
    },

    immunization: {
      invalidate(id: string, patientId: string) {
        revalidateWithProfile(CACHE_TAGS.medical.immunization.byId(id), 'minutes');
        revalidateWithProfile(CACHE_TAGS.medical.immunization.byPatient(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.patient.immunizations(patientId), 'minutes');
      }
    },

    prescription: {
      invalidate(id: string, patientId: string, doctorId: string) {
        revalidateWithProfile(CACHE_TAGS.medical.prescription.byId(id), 'seconds');
        revalidateWithProfile(CACHE_TAGS.medical.prescription.byPatient(patientId), 'seconds');
        revalidateWithProfile(CACHE_TAGS.medical.prescription.byDoctor(doctorId), 'seconds');
        revalidateWithProfile(CACHE_TAGS.medical.prescription.active(patientId), 'seconds');
        revalidateWithProfile(CACHE_TAGS.patient.prescriptions(patientId), 'seconds');
      }
    },

    lab: {
      invalidatePatientLabTests(patientId: string, clinicId: string) {
        revalidateWithProfile(CACHE_TAGS.medical.lab.byPatient(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.medical.lab.byClinic(clinicId), 'minutes');
      },
      invalidate(id: string, patientId: string | undefined, clinicId: string) {
        revalidateWithProfile(CACHE_TAGS.medical.lab.byId(id), 'minutes');
        revalidateWithProfile(CACHE_TAGS.medical.lab.byPatient(patientId ?? ''), 'minutes');
        revalidateWithProfile(CACHE_TAGS.medical.lab.byClinic(clinicId), 'minutes');
      }
    }
  },

  // ==================== FINANCIAL ====================
  financial: {
    payment: {
      invalidate(id: string, patientId: string, clinicId: string) {
        revalidateWithProfile(CACHE_TAGS.financial.payment.byId(id), 'seconds');
        revalidateWithProfile(CACHE_TAGS.financial.payment.byPatient(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.financial.payment.byClinic(clinicId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.patient.billing(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
      }
    },

    bill: {
      invalidate(id: string, patientId: string, paymentId: string) {
        revalidateWithProfile(CACHE_TAGS.financial.bill.byId(id), 'minutes');
        revalidateWithProfile(CACHE_TAGS.financial.bill.byPatient(patientId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.financial.bill.byPayment(paymentId), 'minutes');
      }
    },

    expense: {
      invalidate(id: string, clinicId: string) {
        revalidateWithProfile(CACHE_TAGS.financial.expense.byId(id), 'minutes');
        revalidateWithProfile(CACHE_TAGS.financial.expense.byClinic(clinicId), 'minutes');
        revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
      }
    }
  },

  // ==================== ADMIN ====================
  admin: {
    invalidateDashboard(clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.admin.dashboard(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.clinic.dashboard(clinicId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.clinic.counts(clinicId), 'minutes');
    },

    invalidateActivity(userId: string, clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.admin.activity(userId), 'minutes');
      revalidateWithProfile(CACHE_TAGS.admin.activityByClinic(clinicId), 'minutes');
    },

    invalidateReports(clinicId: string, reportType?: string) {
      if (reportType) {
        revalidateWithProfile(CACHE_TAGS.admin.reports(clinicId, reportType), 'hours');
      }
      revalidateWithProfile(CACHE_TAGS.admin.dashboard(clinicId), 'minutes');
    }
  },

  // ==================== SYSTEM ====================
  system: {
    invalidateSettings() {
      revalidateWithProfile(CACHE_TAGS.system.settings, 'minutes');
    },

    invalidateWHOStandards() {
      revalidateWithProfile(CACHE_TAGS.system.whoStandards, 'days');
    },

    invalidateDrugs() {
      revalidateWithProfile(CACHE_TAGS.system.drugs, 'days');
    },

    invalidateVaccineSchedule() {
      revalidateWithProfile(CACHE_TAGS.system.vaccineSchedule, 'days');
    }
  },

  // ==================== USER ====================
  user: {
    invalidate(id: string) {
      revalidateWithProfile(CACHE_TAGS.user.byId(id), 'seconds');
    },

    invalidateNotifications(userId: string) {
      revalidateWithProfile(CACHE_TAGS.user.notifications(userId), 'minutes');
    },

    invalidateSavedFilters(userId: string, clinicId: string) {
      revalidateWithProfile(CACHE_TAGS.user.savedFilters(userId, clinicId), 'minutes');
    }
  }
} as const;
