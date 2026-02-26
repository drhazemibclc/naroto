// src/utils/number/decimal.ts
export class DecimalUtils {
  /**
   * Safely convert to number
   */
  toNumber(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const num = Number.parseFloat(value);
      return Number.isNaN(num) ? 0 : num;
    }

    if (this.isDecimalLike(value)) {
      return value.toNumber();
    }

    return 0;
  }

  /**
   * Check if value is Decimal-like
   */
  private isDecimalLike(value: unknown): value is { toNumber: () => number } {
    return (
      !!value &&
      typeof value === 'object' &&
      'toNumber' in value &&
      typeof (value as { toNumber: unknown }).toNumber === 'function'
    );
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number, currency = 'EGP', locale = 'ar-EG'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency
    }).format(amount);
  }

  /**
   * Format percentage
   */
  formatPercentage(value: number, decimals = 1): string {
    return `${value.toFixed(decimals)}%`;
  }

  /**
   * Calculate BMI
   */
  calculateBMI(
    weightKg: number,
    heightCm: number
  ): {
    value: number;
    category: string;
    color: string;
  } {
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);

    let category: string;
    let color: string;

    if (bmi < 18.5) {
      category = 'Underweight';
      color = '#1E90FF';
    } else if (bmi < 25) {
      category = 'Normal';
      color = '#10b981';
    } else if (bmi < 30) {
      category = 'Overweight';
      color = '#FF9800';
    } else {
      category = 'Obese';
      color = '#FF5722';
    }

    return {
      value: Math.round(bmi * 10) / 10,
      category,
      color
    };
  }
}

export const decimalUtils = new DecimalUtils();
