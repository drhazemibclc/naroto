// src/services/appointment/availability.ts

import { addDays, endOfDay, format, isBefore, parseISO, setHours, setMinutes, setSeconds, startOfDay } from 'date-fns';

import { prisma } from '../../client';

// const DEFAULT_TIMEZONE = 'Africa/Cairo';

export interface TimeSlot {
  available: boolean;
  label: string;
  value: string;
}

export class AppointmentAvailabilityService {
  /**
   * Generate time slots
   */
  private generateTimeSlots(startHour = 5, endHour = 23, intervalMinutes = 30): string[] {
    const slots: string[] = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        if (hour === endHour && minute > 0) break;
        slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`);
      }
    }
    return slots;
  }

  /**
   * Format time for display
   */
  private formatTimeForDisplay(time: string): string {
    const [hour, minute] = time.split(':').map(Number);
    const period = (hour ?? 0) >= 12 ? 'PM' : 'AM';
    const displayHour = (hour ?? 0) % 12 || 12;
    return `${displayHour}:${minute?.toString().padStart(2, '0')} ${period}`;
  }

  /**
   * Get available time slots for a doctor
   */
  async getAvailableSlots(doctorId: string, dateStr: string): Promise<TimeSlot[]> {
    // 1. Fetch only necessary doctor fields
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: {
        availableFromWeekDay: true,
        availableToWeekDay: true,
        availableFromTime: true,
        availableToTime: true
      }
    });

    if (!doctor) throw new Error('Doctor not found');

    const selectedDate = parseISO(dateStr);
    const dayOfWeek = selectedDate.getDay();

    // 2. Fast-exit for non-working days
    if (dayOfWeek < (doctor.availableFromWeekDay ?? 0) || dayOfWeek > (doctor.availableToWeekDay ?? 6)) {
      return [];
    }

    // 3. Get existing appointments (Optimized range)
    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: {
          gte: startOfDay(selectedDate),
          lte: endOfDay(selectedDate)
        },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] }
      },
      select: { appointmentDate: true }
    });

    // Store as "HH:mm" for easy lookup
    const bookedSlots = new Set(appointments.map(a => a.appointmentDate.toISOString().substring(11, 16)));

    // 4. Parse availability
    const [fromHour] = (doctor.availableFromTime || '09:00').split(':').map(Number);
    const [toHour] = (doctor.availableToTime || '17:00').split(':').map(Number);

    const slots = this.generateTimeSlots(fromHour, toHour);
    const now = new Date(); // Use system time or zoned time as needed

    return slots.map(time => {
      const [hour, minute] = time.split(':').map(Number);

      // Create slot time without mutating selectedDate
      const slotDateTime = setSeconds(setMinutes(setHours(startOfDay(selectedDate), hour ?? 0), minute ?? 0), 0);

      // 5. Availability Logic: Not booked AND (is in the future if today)
      const isBooked = bookedSlots.has(time);
      const isPast = isBefore(slotDateTime, now);

      return {
        value: time,
        label: this.formatTimeForDisplay(time),
        available: !(isBooked || isPast)
      };
    });
  }

  /**
   * Get next available appointment
   */
  async getNextAvailable(doctorId: string): Promise<Date | null> {
    const maxDaysAhead = 30;
    const today = new Date();

    // 1. Fetch doctor availability and existing appointments in a single batch
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        appointments: {
          where: {
            appointmentDate: {
              gte: startOfDay(today),
              lte: addDays(startOfDay(today), maxDaysAhead)
            },
            status: { notIn: ['CANCELLED', 'NO_SHOW'] }
          },
          select: { appointmentDate: true }
        }
      }
    });

    if (!doctor) return null;

    // 2. Map appointments to a searchable set for O(1) lookup
    // Format: "YYYY-MM-DD HH:mm"
    const bookedSlots = new Set(doctor.appointments.map(a => format(a.appointmentDate, 'yyyy-MM-dd HH:mm')));

    // 3. Iterate through days (No DB calls inside this loop!)
    for (let i = 0; i < maxDaysAhead; i++) {
      const checkDate = addDays(today, i);
      const dayOfWeek = checkDate.getDay();

      // Check if doctor works this weekday
      if (dayOfWeek < (doctor.availableFromWeekDay ?? 0) || dayOfWeek > (doctor.availableToWeekDay ?? 6)) {
        continue;
      }

      const [fromHour] = (doctor.availableFromTime || '09:00').split(':').map(Number);
      const [toHour] = (doctor.availableToTime || '17:00').split(':').map(Number);

      // Reuse your existing logic to get potential time strings (e.g., ["09:00", "09:30"...])
      const timeStrings = this.generateTimeSlots(fromHour, toHour);
      const dateStr = format(checkDate, 'yyyy-MM-dd');

      for (const time of timeStrings) {
        const [hour, minute] = time.split(':').map(Number);
        const slotDate = setMinutes(setHours(startOfDay(checkDate), hour ?? 0), minute ?? 0);

        // Check if slot is in the future AND not booked
        const isFuture = slotDate > today;
        const isBooked = bookedSlots.has(`${dateStr} ${time}`);

        if (isFuture && !isBooked) {
          return slotDate;
        }
      }
    }

    return null;
  }
}
export const appointmentAvailability = new AppointmentAvailabilityService();
