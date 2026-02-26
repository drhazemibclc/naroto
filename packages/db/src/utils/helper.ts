import { endOfMonth, format, getMonth, startOfYear } from 'date-fns';

import type { AppointmentStatus } from '../types';

interface Appointment {
  appointmentDate: Date;
  status: AppointmentStatus | null;
}

function isValidStatus(status: string): status is AppointmentStatus {
  return ['CANCELLED', 'COMPLETED', 'NO_SHOW', 'PENDING', 'SCHEDULED'].includes(status);
}

const initializeMonthlyData = () => {
  const currentYear = new Date().getFullYear();
  const currentMonthIndex = getMonth(new Date());

  return Array.from({ length: currentMonthIndex + 1 }, (_, index) => ({
    appointment: 0,
    completed: 0,
    name: format(new Date(currentYear, index), 'MMM')
  }));
};

export const processAppointments = (appointments: Appointment[]) => {
  const monthlyData = initializeMonthlyData();
  const appointmentCounts: Record<AppointmentStatus, number> = {
    CANCELLED: 0,
    COMPLETED: 0,
    PENDING: 0,
    NO_SHOW: 0,
    SCHEDULED: 0
  };

  const currentYearStart = startOfYear(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  for (const appointment of appointments) {
    const { status, appointmentDate } = appointment;

    // Aggregate counts for appointments within the current year and up to the current month
    if (appointmentDate >= currentYearStart && appointmentDate <= currentMonthEnd) {
      const monthIndex = getMonth(appointmentDate);
      const monthData = monthlyData[monthIndex];
      if (monthData) {
        monthData.appointment += 1;
        if (status === 'COMPLETED') {
          monthData.completed += 1;
        }
      }
    }

    // Aggregate counts for all appointments by status
    if (status && isValidStatus(status)) {
      appointmentCounts[status] += 1;
    }
  }

  return { appointmentCounts, monthlyData };
};

// =========== HELPER FUNCTIONS ===========
export interface VitalSignsCalculationInput {
  createdAt?: Date | null;
  diastolic?: number | string | null;
  heartRate?: number | string | null;
  recordedAt?: Date | null;
  systolic?: number | string | null;
  temperature?: number | string | null;
}
export function processVitalSignsData(data: VitalSignsCalculationInput[]) {
  if (!data.length) {
    return {
      data: [],
      average: '0/0',
      heartRateData: [],
      temperatureData: [],
      summary: {
        lastRecorded: null,
        hasAbnormalValues: false,
        totalReadings: 0
      }
    };
  }

  interface VitalAccumulator {
    dia: number;
    heartRate: number;
    sys: number;
    temperature: number;
  }

  const averages = data.reduce<VitalAccumulator>(
    (acc, curr) => {
      // 2. Convert to Number immediately to fix "string | number" operator errors
      const sys = Number(curr.systolic) || 120;
      const dia = Number(curr.diastolic) || 80;
      const hr = Number(curr.heartRate) || 72;
      const temp = Number(curr.temperature) || 36.6;

      return {
        sys: acc.sys + sys,
        dia: acc.dia + dia,
        heartRate: acc.heartRate + hr,
        temperature: acc.temperature + temp
      };
    },
    // 3. Initial value matches VitalAccumulator
    { sys: 0, dia: 0, heartRate: 0, temperature: 0 }
  );

  const hasAbnormalValues = data.some(v => {
    // FIX: Convert to Number before comparison to avoid "string > number" errors
    const sys = Number(v.systolic);
    const dia = Number(v.diastolic);
    const hr = Number(v.heartRate);
    const temp = Number(v.temperature);

    return (
      (sys && (sys > 140 || sys < 90)) ||
      (dia && (dia > 90 || dia < 60)) ||
      (hr && (hr > 100 || hr < 60)) ||
      (temp && (temp > 38 || temp < 35))
    );
  });

  return {
    data: data.map(v => {
      // FIX: format() needs a Date. Fallback to now if both are null/undefined.
      const date = v.recordedAt || v.createdAt || new Date();
      return {
        label: format(date, 'MMM d'),
        systolic: v.systolic,
        diastolic: v.diastolic,
        timestamp: date
      };
    }),
    heartRateData: data.map(v => {
      const date = v.recordedAt || v.createdAt || new Date();
      return {
        label: format(date, 'MMM d HH:mm'),
        heartRate: v.heartRate,
        timestamp: date
      };
    }),
    temperatureData: data.map(v => {
      const date = v.recordedAt || v.createdAt || new Date();
      return {
        label: format(date, 'MMM d HH:mm'),
        temperature: v.temperature,
        timestamp: date
      };
    }),
    average: `${(averages.sys / data.length).toFixed(1)}/${(averages.dia / data.length).toFixed(1)}`,
    summary: {
      lastRecorded: data[0]?.recordedAt || data[0]?.createdAt || null,
      hasAbnormalValues,
      totalReadings: data.length,
      averageHeartRate: (averages.heartRate / data.length).toFixed(1),
      averageTemperature: (averages.temperature / data.length).toFixed(1)
    }
  };
}
