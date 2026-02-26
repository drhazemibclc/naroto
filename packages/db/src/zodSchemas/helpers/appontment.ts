import type { AppointmentStatus } from '@generated/browser';
import { endOfMonth, format, getMonth, startOfYear } from 'date-fns';

interface Appointment {
  appointmentDate: Date;
  status: AppointmentStatus | null;
}

function isValidStatus(status: string): status is AppointmentStatus {
  return ['CANCELLED', 'COMPLETED', 'PENDING', 'SCHEDULED'].includes(status);
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
    SCHEDULED: 0,
    NO_SHOW: 0
  };

  const currentYearStart = startOfYear(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  for (const appointment of appointments) {
    const { status, appointmentDate: date } = appointment;

    // Aggregate counts for appointments within the current year and up to the current month
    if (date >= currentYearStart && date <= currentMonthEnd) {
      const monthIndex = getMonth(date);
      if (monthlyData[monthIndex]) {
        monthlyData[monthIndex].appointment += 1;
        if (status === 'COMPLETED') {
          monthlyData[monthIndex].completed += 1;
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
