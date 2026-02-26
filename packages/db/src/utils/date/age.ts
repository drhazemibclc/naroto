// src/utils/date/age.ts
export interface AgeResult {
  days: number;
  formatted: string;
  months: number;
  years: number;
}

export class AgeCalculator {
  /**
   * Calculate age from date of birth
   */
  calculate(dateOfBirth: Date | string, referenceDate: Date = new Date()): AgeResult {
    const dob = new Date(dateOfBirth);
    const ref = new Date(referenceDate);

    // Total days
    const days = Math.floor((ref.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate years and months
    let years = ref.getFullYear() - dob.getFullYear();
    let months = ref.getMonth() - dob.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    // Adjust for day of month
    if (ref.getDate() < dob.getDate()) {
      months--;
      if (months < 0) {
        years--;
        months += 12;
      }
    }

    // Format for display
    let formatted: string;
    if (years === 0) {
      if (months === 0 || months === 1) {
        formatted = `${days} ${days === 1 ? 'day' : 'days'}`;
      } else if (months < 24) {
        formatted = `${months} ${months === 1 ? 'month' : 'months'}`;
      } else {
        formatted = `${years} years`;
      }
    } else {
      formatted = `${years} ${years === 1 ? 'year' : 'years'}, ${months} ${months === 1 ? 'month' : 'months'}`;
    }

    return {
      days,
      months: years * 12 + months,
      years,
      formatted
    };
  }

  /**
   * Get age in months (standard for pediatric metrics)
   */
  inMonths(dateOfBirth: Date | string, referenceDate: Date = new Date()): number {
    const dob = new Date(dateOfBirth);
    const ref = new Date(referenceDate);

    let months = (ref.getFullYear() - dob.getFullYear()) * 12 + (ref.getMonth() - dob.getMonth());

    if (ref.getDate() < dob.getDate()) {
      months--;
    }

    return months;
  }

  /**
   * Get age in days
   */
  inDays(dateOfBirth: Date | string, referenceDate: Date = new Date()): number {
    const dob = new Date(dateOfBirth);
    const ref = new Date(referenceDate);

    return Math.floor((ref.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24));
  }
}

export const ageCalculator = new AgeCalculator();
