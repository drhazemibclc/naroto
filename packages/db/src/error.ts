import logger from '@naroto/logger';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, message: string, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
/**
 * 🔴 CUSTOM ERROR CLASSES
 * Base error classes for the entire application
 * Provides consistent error handling across all layers
 */

// ==================== BASE ERROR ====================

export class AppError extends Error {
  readonly name: string;
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational: boolean;
  readonly details?: Record<string, unknown>;
  readonly timestamp: Date;
  readonly requestId?: string;

  constructor(
    message: string,
    options: {
      code?: string;
      statusCode?: number;
      isOperational?: boolean;
      details?: Record<string, unknown>;
      requestId?: string;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = options.statusCode || 500;
    this.code = options.code || 'INTERNAL_ERROR';
    this.isOperational = options.isOperational ?? true;
    this.details = options.details;
    this.timestamp = new Date();
    this.requestId = options.requestId;
    this.cause = options.cause;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      requestId: this.requestId,
      details: this.details,
      isOperational: this.isOperational,
      stack: this.stack,
      cause: this.cause instanceof Error ? this.cause.message : this.cause
    };
  }

  /**
   * Get safe response object (without stack traces)
   */
  toResponse(): Record<string, unknown> {
    const response = {
      error: {
        code: this.code,
        message: this.message,
        timestamp: this.timestamp.toISOString(),
        details: this.details as Record<string, unknown> | undefined,
        requestId: this.requestId
      }
    } as Record<string, unknown>;

    if (!this.details) (response.error as Record<string, unknown>).details = undefined;
    if (!this.requestId) (response.error as Record<string, unknown>).requestId = undefined;

    return response;
  }
}

// ==================== HTTP ERROR CLASSES ====================

/**
 * 400 - Bad Request
 * Used for validation errors, malformed requests
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>, requestId?: string) {
    super(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details,
      requestId
    });
  }
}

/**
 * 401 - Unauthorized
 * Used for missing or invalid authentication
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', requestId?: string) {
    super(message, {
      code: 'UNAUTHORIZED',
      statusCode: 401,
      requestId
    });
  }
}

/**
 * 403 - Forbidden
 * Used for authenticated but insufficient permissions
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions', requestId?: string) {
    super(message, {
      code: 'FORBIDDEN',
      statusCode: 403,
      requestId
    });
  }
}

/**
 * 404 - Not Found
 * Used for resources that don't exist
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string, requestId?: string) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;

    super(message, {
      code: 'NOT_FOUND',
      statusCode: 404,
      details: { resource, id },
      requestId
    });
  }
}

/**
 * 409 - Conflict
 * Used for duplicate entries, state conflicts
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>, requestId?: string) {
    super(message, {
      code: 'CONFLICT',
      statusCode: 409,
      details,
      requestId
    });
  }
}

/**
 * 422 - Unprocessable Entity
 * Used for business logic violations
 */
export class BusinessRuleError extends AppError {
  constructor(message: string, rule?: string, details?: Record<string, unknown>, requestId?: string) {
    super(message, {
      code: 'BUSINESS_RULE_VIOLATION',
      statusCode: 422,
      details: { rule, ...details },
      requestId
    });
  }
}

/**
 * 429 - Too Munknown Requests
 * Used for rate limiting
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter?: number, requestId?: string) {
    super(message, {
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      details: { retryAfter },
      requestId
    });
  }
}

// ==================== DOMAIN-SPECIFIC ERRORS ====================

/**
 * Database errors
 */
export class DatabaseError extends AppError {
  constructor(message: string, operation?: string, details?: Record<string, unknown>, requestId?: string) {
    super(message, {
      code: 'DATABASE_ERROR',
      statusCode: 500,
      details: { operation, ...details },
      requestId,
      isOperational: false // Database errors are usually not operational
    });
  }
}

/**
 * Duplicate entry error (specialized ConflictError)
 */
export class DuplicateEntryError extends ConflictError {
  constructor(entity: string, field: string, value: string, requestId?: string) {
    super(`${entity} with ${field} '${value}' already exists`, { entity, field, value }, requestId);
  }
}

/**
 * Invalid state transition error
 */
export class InvalidStateError extends BusinessRuleError {
  constructor(entity: string, fromState: string, toState: string, requestId?: string) {
    super(
      `Cannot transition ${entity} from ${fromState} to ${toState}`,
      'INVALID_STATE_TRANSITION',
      { entity, fromState, toState },
      requestId
    );
  }
}

/**
 * Dependency error (referenced by other records)
 */
export class DependencyError extends ConflictError {
  constructor(entity: string, id: string, dependentEntity: string, requestId?: string) {
    super(
      `Cannot delete ${entity} with id ${id} because it has associated ${dependentEntity}`,
      { entity, id, dependentEntity },
      requestId
    );
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends AppError {
  constructor(message: string, setting?: string, requestId?: string) {
    super(message, {
      code: 'CONFIGURATION_ERROR',
      statusCode: 500,
      details: { setting },
      requestId,
      isOperational: false
    });
  }
}

/**
 * External service error
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, requestId?: string) {
    super(message, {
      code: 'EXTERNAL_SERVICE_ERROR',
      statusCode: 503,
      details: { service },
      requestId,
      isOperational: false
    });
  }
}

// ==================== ERROR HANDLER UTILITY ====================

export interface ErrorHandlerOptions {
  defaultMessage?: string;
  log?: boolean;
  rethrow?: boolean;
}

/**
 * Error handler utility for consistent error processing
 */
/**
 * 🛠️ ERROR HANDLER UTILITIES
 * Refactored from static class to functional exports
 */

export const normalizeError = (error: unknown, defaultMessage = 'An unexpected error occurred'): AppError => {
  if (error instanceof AppError) return error;

  if (error instanceof Error) {
    // 1. Prisma Error Handling
    if (error.name === 'PrismaClientKnownRequestError') {
      return handlePrismaError(error);
    }

    // 2. Zod Validation Error Handling
    if (error.name === 'ZodError') {
      return new ValidationError(error.message, { zod: (error as unknown as { issues: unknown[] }).issues });
    }

    return new AppError(error.message, {
      code: 'UNKNOWN_ERROR',
      cause: error,
      isOperational: false
    });
  }

  if (typeof error === 'string') {
    return new AppError(error, { code: 'STRING_ERROR', isOperational: false });
  }

  return new AppError(defaultMessage, {
    code: 'UNKNOWN_ERROR',
    isOperational: false
  });
};

const handlePrismaError = (error: Error): AppError => {
  const p = error as Error & {
    code?: string;
    meta?: {
      modelName?: string;
      target?: string[];
      cause?: string;
      column_name?: string;
      argument_name?: string;
      field_name?: string;
    };
    requestId?: string;
  };

  switch (p.code) {
    case 'P2002':
      return new DuplicateEntryError(
        p.meta?.modelName || 'Record',
        p.meta?.target?.[0] || 'field',
        Array.isArray(p.meta?.target) ? p.meta.target.join(', ') : p.meta?.target || 'unknown',
        p.requestId
      );
    case 'P2003':
      return new DependencyError(
        p.meta?.modelName || 'Record',
        p.meta?.argument_name || 'unknown',
        p.meta?.field_name || 'related record'
      );
    case 'P2025':
      return new NotFoundError(p.meta?.modelName || 'Record', p.meta?.cause);
    case 'P2000':
      return new ValidationError(`Value too long for column ${p.meta?.column_name || 'unknown'}`);
    default:
      return new DatabaseError(`DB Error: ${p.message}`, 'UNKNOWN_OP', { code: p.code });
  }
};

const logError = (error: AppError): void => {
  const isFatal = error.statusCode >= 500;
  const logLevel = isFatal ? 'error' : 'warn';

  // Assuming 'logger' is imported from your naroto/logger
  logger[logLevel](error.message, { ...error.toJSON(), stack: isFatal ? error.stack : undefined });
};

/**
 * Main export to handle and return an error
 */
export const handleError = (error: unknown, options: ErrorHandlerOptions = {}): AppError => {
  const { log = true, defaultMessage } = options;
  const appError = normalizeError(error, defaultMessage);

  if (log) logError(appError);
  return appError;
};

/**
 * Functional Wrapper: [Data, Error] pattern (Go-style)
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  options: ErrorHandlerOptions = {}
): Promise<[T | null, AppError | null]> {
  try {
    const data = await fn();
    return [data, null];
  } catch (error) {
    return [null, handleError(error, options)];
  }
}
// ==================== ERROR CODES ====================

export const ErrorCodes = {
  // General (1000-1999)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',

  // Database (2000-2999)
  DATABASE_ERROR: 'DATABASE_ERROR',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  FOREIGN_KEY_VIOLATION: 'FOREIGN_KEY_VIOLATION',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
  DEADLOCK_DETECTED: 'DEADLOCK_DETECTED',

  // Domain-specific (3000-3999)
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  APPOINTMENT_OVERLAP: 'APPOINTMENT_OVERLAP',
  PATIENT_NOT_ELIGIBLE: 'PATIENT_NOT_ELIGIBLE',
  VACCINE_NOT_AVAILABLE: 'VACCINE_NOT_AVAILABLE',

  // External services (4000-4999)
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  THIRD_PARTY_TIMEOUT: 'THIRD_PARTY_TIMEOUT',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',

  // File operations (5000-5999)
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  UPLOAD_FAILED: 'UPLOAD_FAILED'
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

// ==================== EXPORTS ====================

export default {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  RateLimitError,
  DatabaseError,
  DuplicateEntryError,
  InvalidStateError,
  DependencyError,
  ConfigurationError,
  ExternalServiceError,
  ErrorCodes
};
