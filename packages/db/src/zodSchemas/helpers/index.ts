import type Decimal from 'decimal.js';
import z from 'zod';

export function decimalToNumber(value?: Decimal | number | null): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

/** Zod schema for "Decimal-like" objects */
export const DecimalJsLikeSchema = z.object({
  toNumber: z.function(), // just a function, no .returns()
  toString: z.function() // just a function, no .returns()
});

/** Type guard for Decimal-like objects */
interface DecimalLike {
  toNumber: () => number;
}

/** Check if value is Decimal-like */
function isDecimalLike(value: unknown): value is DecimalLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toNumber' in value &&
    typeof (value as DecimalLike).toNumber === 'function'
  );
}

/**
 * Validate any value as a Decimal-like input
 * Accepts: number | string | Prisma.Decimal | Decimal-like
 */
export function isValidDecimalInput(value: unknown): boolean {
  if (typeof value === 'number') return true;
  if (typeof value === 'string') return !Number.isNaN(Number(value));
  if (isDecimalLike(value)) {
    try {
      value.toNumber();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
export const NullableDecimal = z
  .union([
    z.number(),
    z.string(),
    // z.instanceof(Prisma.Decimal) if used on backend
    DecimalJsLikeSchema
  ])
  .refine(isValidDecimalInput, { message: 'Must be a Decimal' });

/**
 * Convert any valid decimal input to a JS number
 * Throws if input is invalid
 */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = Number(value);
    if (Number.isNaN(num)) throw new Error(`Invalid number string: ${value}`);
    return num;
  }
  if (isDecimalLike(value)) {
    return value.toNumber();
  }
  throw new Error('Invalid decimal input');
}
