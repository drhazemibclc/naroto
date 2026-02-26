export * from './buildQuery';
export * from './currency';
export * from './date/age';
export * from './decimal';
export * from './getScore';
export * from './notifications';
export * from './pediatrics';
export * from './scoreCalc';
export * from './seetings';
export * from './time';
export * from './vaccine';
export function formatNumber(amount: number): string {
  return amount?.toLocaleString('en-US', {
    maximumFractionDigits: 0
  });
}

export function getInitials(name: string): string {
  const words = name.trim().split(' ');

  const firstTwoWords = words.slice(0, 2);

  const initials = firstTwoWords.map(word => word.charAt(0).toUpperCase());

  return initials.join('');
}

export const getInitial = (firstName: string, lastName: string): string => {
  const firstInitial = firstName?.[0] ?? '';
  const lastInitial = lastName?.[0] ?? '';
  return `${firstInitial}${lastInitial}`.toUpperCase();
};

export const getGenderLabel = (gender: string): string => {
  const labels: Record<string, string> = {
    MALE: 'Male',
    FEMALE: 'Female'
  };
  return labels[gender] ?? 'Unknown';
};

export const formatPhoneNumber = (phone?: string | null): string => {
  if (!phone) {
    return 'No phone';
  }
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return cleaned || phone;
};

export const calculateAge = (dateOfBirth: string | Date): number => {
  const birth = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age += 1;
  }
  return age;
};

export function formatDateTime(isoDate: string | Date): string {
  const date = new Date(isoDate);

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
    // timeZoneName: "short", // "UTC"
  };

  return date.toLocaleString('en-US', options);
}
/**
 * Formats a date of birth into a human-readable age.
 * - Under 2 months: Shows weeks (e.g., "6 weeks")
 * - Under 2 years: Shows months (e.g., "14 months")
 * - Over 2 years: Shows years (e.g., "5 years")
 */
export function formatAge(dateOfBirth: Date | string | number): string {
  const dob = new Date(dateOfBirth);
  const today = new Date();

  const diffInMs = today.getTime() - dob.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const diffInWeeks = Math.floor(diffInDays / 7);
  const diffInMonths = (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth());
  const diffInYears = today.getFullYear() - dob.getFullYear();

  // 1. Under 8 weeks (approx 2 months) -> Show Weeks
  if (diffInWeeks < 8) {
    return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'}`;
  }

  // 2. Under 24 months -> Show Months
  if (diffInMonths < 24) {
    return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'}`;
  }

  // 3. Otherwise -> Show Years
  // Adjust for birthday not yet reached this year
  const birthdayReached =
    today.getMonth() > dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());

  const actualYears = birthdayReached ? diffInYears : diffInYears - 1;

  return `${actualYears} ${actualYears === 1 ? 'year' : 'years'}`;
}

export const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function generateRandomColor(): string {
  let hexColor = '';
  do {
    const randomInt = Math.floor(Math.random() * 16_777_216);

    hexColor = `#${randomInt.toString(16).padStart(6, '0')}`;
  } while (hexColor.toLowerCase() === '#ffffff' || hexColor.toLowerCase() === '#000000'); // Ensure it’s not white or black
  return hexColor;
}

export function formatTimeByHours(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const adjustedHour = hour % 12 || 12;
  const formattedMinute = minute.toString().padStart(2, '0');
  return `${adjustedHour}:${formattedMinute} ${period}`;
}
interface Times {
  label: string;
  value: string;
}
export function generateTimes(start_hour: number, closeHour: number, intervalInMinutes: number) {
  const times: Times[] = [];
  const startHour = start_hour;
  const endHour = closeHour;
  const intervalMinutes = intervalInMinutes;

  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += intervalMinutes) {
      if (hour === endHour && minute > 0) {
        break;
      }
      const formattedTime = formatTimeByHours(hour, minute);
      times.push({ label: formattedTime, value: formattedTime });
    }
  }

  return times;
}

export const calculateBMI = (weight: number, height: number) => {
  const heightInMeters = height / 100;

  const bmi = weight / (heightInMeters * heightInMeters);

  let status: string;
  let colorCode: string;

  if (bmi < 18.5) {
    status = 'Underweight';
    colorCode = '#1E90FF';
  } else if (bmi >= 18.5 && bmi <= 24.9) {
    status = 'Normal';
    colorCode = '#1E90FF';
  } else if (bmi >= 25 && bmi <= 29.9) {
    status = 'Overweight';
    colorCode = '#FF9800';
  } else {
    status = 'Obesity';
    colorCode = '#FF5722';
  }

  return {
    bmi: Number.parseFloat(bmi.toFixed(2)),
    status,
    colorCode
  };
};

interface DiscountInput {
  amount: number;
  discount?: number;
  discountPercentage?: number;
}

export function calculateDiscount({ amount, discount, discountPercentage }: DiscountInput): {
  finalAmount: number;
  discountPercentage?: number;
  discountAmount?: number;
} {
  if (discount != null && discountPercentage != null) {
    throw new Error('Provide either discount amount or discount percentage, not both.');
  }

  if (discount != null) {
    // Calculate discount percentage if a discount amount is provided
    const discountPercent = (discount / amount) * 100;
    return {
      finalAmount: amount - discount,
      discountPercentage: discountPercent,
      discountAmount: discount
    };
  }
  if (discountPercentage != null) {
    // Calculate discount amount if a discount percentage is provided
    const discountAmount = (discountPercentage / 100) * amount;
    return {
      finalAmount: amount - discountAmount,
      discountPercentage,
      discountAmount
    };
  }
  throw new Error('Please provide either a discount amount or a discount percentage.');
}
export const formatTime = (date: Date | null | undefined, startTime?: string) => {
  if (!date) {
    return 'N/A';
  }

  const appointmentDate = new Date(date);
  if (startTime) {
    return startTime;
  }

  return appointmentDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

export const formatDuration = (durationMinutes?: number) => {
  if (!durationMinutes) {
    return 'N/A';
  }

  if (durationMinutes >= 60) {
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${durationMinutes}m`;
};

export const getAvatarColor = (doctorId?: string) => {
  if (!doctorId) {
    return 'bg-gray-100 text-gray-600';
  }

  // Generate consistent color based on doctorId
  const colors = [
    'bg-blue-100 text-blue-600',
    'bg-green-100 text-green-600',
    'bg-purple-100 text-purple-600',
    'bg-amber-100 text-amber-600',
    'bg-pink-100 text-pink-600',
    'bg-cyan-100 text-cyan-600',
    'bg-indigo-100 text-indigo-600'
  ];

  const hash = doctorId.split('').reduce((acc, char) => {
    return Math.imul(31, acc) + char.charCodeAt(0);
  }, 0);

  return colors[Math.abs(hash) % colors.length];
};

export const getTimeframeStartDate = (timeframe: 'day' | 'week' | 'month' | 'year' | 'all'): Date | null => {
  const now = new Date();

  if (timeframe === 'day') {
    return new Date(now.setHours(0, 0, 0, 0));
  }
  if (timeframe === 'week') {
    return new Date(now.setDate(now.getDate() - 7));
  }
  if (timeframe === 'month') {
    return new Date(now.setMonth(now.getMonth() - 1));
  }
  if (timeframe === 'year') {
    return new Date(now.setFullYear(now.getFullYear() - 1));
  }

  return null;
};

export const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return 'Today';
  }
  if (diffInDays === 1) {
    return 'Yesterday';
  }
  if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  }
  if (diffInDays < 30) {
    return `${Math.floor(diffInDays / 7)} weeks ago`;
  }
  if (diffInDays < 365) {
    return `${Math.floor(diffInDays / 30)} months ago`;
  }
  return `${Math.floor(diffInDays / 365)} years ago`;
};

// export const calculateAge = (dateOfBirth: Date): string => {
//   const today = new Date();
//   let years = today.getFullYear() - dateOfBirth.getFullYear();
//   let months = today.getMonth() - dateOfBirth.getMonth();

//   if (months < 0) {
//     years--;
//     months += 12;
//   }

//   if (today.getDate() < dateOfBirth.getDate()) {
//     months--;
//     if (months < 0) {
//       years--;
//       months += 12;
//     }
//   }

//   if (years === 0) {
//     return `${months}m`;
//   }
//   return `${years}y ${months}m`;
// };
