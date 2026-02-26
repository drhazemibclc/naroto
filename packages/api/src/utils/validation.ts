import { TRPCError } from '@trpc/server';
import type { TRPCErrorShape } from '@trpc/server/rpc';
import type z from 'zod';
import { ZodError } from 'zod';

// ==================== ZOD ERROR HANDLING UTILITIES ====================

/**
 * Formats Zod validation errors for better client-side handling
 */
export function formatZodError(error: ZodError): {
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
  errorMap: Map<string, string[]>;
} {
  const fieldErrors: Record<string, string[]> = {};
  const formErrors: string[] = [];
  const errorMap = new Map<string, string[]>();
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    const message = issue.message;

    // Group errors by field
    if (path) {
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(message);
      errorMap.set(path, fieldErrors[path]);
    } else {
      formErrors.push(message);
    }
  }

  return { fieldErrors, formErrors, errorMap };
}

/**
 * Creates a user-friendly TRPCError from Zod validation error
 */
export function createValidationError(error: ZodError, _context: string | undefined): TRPCError {
  const { formErrors } = formatZodError(error);

  // const errorSummary = {
  //   message: 'Validation failed',
  //   context: context || 'Unknown',
  //   fieldErrors,
  //   formErrors,
  //   issueCount: error.issues.length
  // };

  return new TRPCError({
    code: 'BAD_REQUEST',
    message: `Validation failed: ${formErrors.join(', ') || 'Please check your input'}`,
    cause: error
  });
}

/**
 * Enhanced error formatter for tRPC with detailed Zod error handling
 */
export function enhancedErrorFormatter({ shape, error }: { shape: TRPCErrorShape; error: TRPCError }) {
  // Handle Zod validation errors
  if (error.cause instanceof ZodError) {
    const { fieldErrors, formErrors } = formatZodError(error.cause);

    return {
      ...shape,
      data: {
        ...shape.data,
        code: 'VALIDATION_ERROR',
        zodError: {
          message: error.cause.message,
          fieldErrors,
          formErrors,
          issueCount: error.cause.issues.length,
          // ✅ Changed: issue type is inferred from z.ZodIssue
          issues: error.cause.issues.map((issue: z.ZodIssue) => ({
            path: issue.path,
            message: issue.message,
            code: issue.code,
            // Use type narrowing or 'in' check for extra properties
            expected: 'expected' in issue ? issue.expected : undefined,
            received: 'received' in issue ? issue.received : undefined
          }))
        }
      }
    };
  }

  // Handle other types of errors
  if (error.cause instanceof Error) {
    return {
      ...shape,
      data: {
        ...shape.data,
        code: 'APPLICATION_ERROR',
        message: error.cause.message,
        stack: process.env.NODE_ENV === 'development' ? error.cause.stack : undefined
      }
    };
  }

  // Default error handling
  return {
    ...shape,
    data: {
      ...shape.data,
      code: shape.code || 'INTERNAL_SERVER_ERROR',
      message: shape.message || 'An unexpected error occurred'
    }
  };
}

/**
 * Middleware for automatic Zod error handling
 */
export function createZodValidationMiddleware() {
  return async ({ next }: { next: () => Promise<unknown> }) => {
    try {
      return await next();
    } catch (error) {
      if (error instanceof ZodError) {
        throw createValidationError(error, 'Middleware');
      }
      throw error;
    }
  };
}

/**
 * Validation helper with detailed error reporting
 */
export function validateWithDetails<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): { success: true; data: T } | { success: false; error: TRPCError } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: createValidationError(error, context)
      };
    }
    throw error;
  }
}

/**
 * Common validation error messages
 */
export const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid phone number',
  INVALID_DATE: 'Please enter a valid date',
  INVALID_UUID: 'Please enter a valid ID',
  MIN_LENGTH: (min: number) => `Must be at least ${min} characters`,
  MAX_LENGTH: (max: number) => `Must be no more than ${max} characters`,
  INVALID_FORMAT: 'Please enter a valid format',
  PAST_DATE: 'Date cannot be in the past',
  FUTURE_DATE: 'Date cannot be in the future',
  INVALID_RANGE: (min: number, max: number) => `Must be between ${min} and ${max}`,
  POSITIVE_NUMBER: 'Must be a positive number',
  NON_NEGATIVE: 'Cannot be negative',
  REQUIRED_IF: (condition: string) => `Required when ${condition}`
} as const;

/**
 * Field-level validation helpers
 */
export const fieldValidators = {
  required: (fieldName: string) => ({
    required_error: `${fieldName} is required`
  }),

  email: {
    invalid_type_error: 'Must be a valid email address',
    required_error: 'Email is required'
  },

  phone: {
    invalid_type_error: 'Must be a valid phone number',
    required_error: 'Phone number is required'
  },

  date: {
    invalid_type_error: 'Must be a valid date',
    required_error: 'Date is required'
  },

  uuid: {
    invalid_type_error: 'Must be a valid ID',
    required_error: 'ID is required'
  }
} as const;

/**
 * Error severity levels for client-side handling
 */
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

/**
 * Categorize Zod errors by severity
 */
export function categorizeErrorSeverity(error: ZodError): keyof typeof ERROR_SEVERITY {
  const hasRequiredErrors = error.issues.some(issue => issue.code === 'too_small');
  const hasInvalidFormatErrors = error.issues.some(issue =>
    ['invalid_string', 'invalid_type', 'invalid_enum_value'].includes(issue.code)
  );

  if (hasRequiredErrors) return 'HIGH';
  if (hasInvalidFormatErrors) return 'MEDIUM';
  return 'LOW';
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: string,
  severity: keyof typeof ERROR_SEVERITY = 'MEDIUM'
) {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      severity,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Type guards for error handling
 */
export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}

export function isTRPCError(error: unknown): error is TRPCError {
  return error instanceof TRPCError;
}

/**
 * Async validation helper with timeout
 */
export async function validateWithTimeout<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  timeoutMs = 5000,
  context?: string
): Promise<{ success: true; data: T } | { success: false; error: TRPCError }> {
  return Promise.race([
    validateWithDetails(schema, data, context),
    new Promise<{ success: false; error: TRPCError }>(resolve =>
      setTimeout(() => {
        resolve({
          success: false,
          error: new TRPCError({
            code: 'TIMEOUT',
            message: 'Validation timed out'
          })
        });
      }, timeoutMs)
    )
  ]);
}
