import type { IncomingMessage, ServerResponse } from 'node:http';

import type { LoggerOptions, Logger as PinoLogger } from 'pino';

/**
 * Valid Pino Log Levels
 * Added 'audit' as a custom level.
 */
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'audit';

/**
 * Pediatric-specific Log Types for filtering in Elastic/Sentry
 */
export type LogType =
  | 'PATIENT_REGISTRATION'
  | 'APPOINTMENT'
  | 'ENCOUNTER'
  | 'VITALS'
  | 'GROWTH_CHART'
  | 'IMMUNIZATION'
  | 'PRESCRIPTION'
  | 'LAB_RESULT'
  | 'FEEDING_LOG'
  | 'DEVELOPMENTAL_CHECK'
  | 'BILLING'
  | 'USER_ACTION'
  | 'SECURITY'
  | 'SYSTEM'
  | 'AI_NUTRITION'
  | 'QUEUE_UPDATE'
  | 'AUDIT'
  | 'PERFORMANCE'
  | 'PATIENT_FLOW';

/**
 * Metadata shared across all logs.
 * We extend Record<string, unknown> to satisfy Pino's object requirements.
 */
export interface LogMetadata extends Record<string, unknown> {
  appointmentId?: string;
  clinicId?: string;
  duration?: number;
  environment?: string;
  patientId?: string;
  requestId?: string;
  type?: LogType;
  userId?: string;
  version?: string;
}

export interface AuditDetails {
  action: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  ip?: string;
  reason?: string;
  resource: string;
  resourceId: string;
  userAgent?: string;
  userId: string;
}

/**
 * Main Logger Interface
 */
export interface ILogger {
  appointment(appointmentId: string, action: string, metadata?: LogMetadata): void;
  audit(details: AuditDetails): void;

  // Context Management
  child(metadata: LogMetadata): ILogger;
  clinical(level: LogLevel, message: string, patientId: string, metadata?: LogMetadata): void;
  close(): Promise<void>;
  debug(msg: string, metadata?: LogMetadata): void;
  error(msg: string, metadata?: LogMetadata, error?: Error): void;

  // Core Methods (Pino Style: Metadata first, then message)
  fatal(msg: string, metadata?: LogMetadata, error?: Error): void;

  // Lifecycle
  flush(): Promise<void>;
  info(msg: string, metadata?: LogMetadata): void;

  // Pediatric & Clinical Domain Methods
  patientFlow(patientId: string, action: string, metadata?: LogMetadata): void;
  performance(operation: string, duration: number, metadata?: LogMetadata): void;
  // Access to the underlying Pino instance if needed
  readonly pino: PinoLogger;
  security(event: string, metadata?: LogMetadata): void;
  trace(msg: string, metadata?: LogMetadata): void;
  warn(msg: string, metadata?: LogMetadata): void;
  withRequest(req: IncomingMessage, res: ServerResponse): ILogger;
}

/**
 * Config for the Logger Factory
 */
export interface PediatricLoggerConfig extends Omit<LoggerOptions, 'level'> {
  environment: 'development' | 'production' | 'test';
  level: LogLevel;
  redactFields?: string[];
  serviceName: string;
}

/**
 * PHI/PII sensitive fields to redact (HIPAA Compliance)
 */
export const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'ssn',
  'mrn',
  'patient_id',
  'email',
  'phone',
  'address',
  'dob',
  'date_of_birth',
  'diagnosis',
  'medication'
] as const;

// types.ts

export interface LogContext {
  action?: string;
  clinicId?: string;
  doctorId?: string;
  ip?: string;
  method?: string;
  module?: string;
  path?: string;
  patientId?: string;
  requestId?: string;
  resource?: string;
  resourceId?: string;
  startTime?: Date;
  userAgent?: string;
  userId?: string;
  [key: string]: unknown;
}

export interface LogMetadata extends Record<string, unknown> {
  appointmentId?: string;
  doctorId?: string;
  duration?: number;
  patientId?: string;
  type?: LogType;
}

export interface AuditDetails {
  changes?: Record<string, { from: unknown; to: unknown }>;
  ip?: string;
  reason?: string;
  userAgent?: string;
  userId: string;
}

export interface ErrorDetails {
  cause?: Error;
  code?: string | number;
  isOperational?: boolean;
  message: string;
  name: string;
  stack?: string;
  statusCode?: number;
}

export interface LogEntry {
  audit?: {
    action: string;
    resource: string;
    resourceId: string;
    details: AuditDetails;
  };
  error?: ErrorDetails;
  level: LogLevel;
  message: string;
  metadata?: LogMetadata;
  timestamp: Date;
}

export interface Transport {
  close?(): Promise<void>;
  log(entry: LogEntry): Promise<void>;
  name: string;
}

export interface TransportConfig {
  enabled: boolean;
  level?: LogLevel | LogLevel[];
  options?: Record<string, unknown>;
  type: 'console' | 'file' | 'database' | 'sentry' | 'custom';
}

export interface LoggerConfig {
  appName: string;
  async: boolean;
  bufferSize: number;
  environment: string;
  flushInterval: number;
  level: LogLevel;
  prettyPrint: boolean;
  redactFields: string[];
  redactPaths: string[];
  sampleRate?: number; // For performance sampling
  sentryDsn?: string;
  service: string;
  timestampFormat: string;
  transports: TransportConfig[];
  version?: string;
}

export interface ILogger {
  addTransport(transport: Transport): void;
  appointment(action: string, appointmentId: string, metadata?: LogMetadata): void;
  audit(action: string, resource: string, resourceId: string, details: AuditDetails): void;

  // Context management
  child(metadata: LogMetadata): ILogger;
  clinical(level: LogLevel, message: string, patientId: string, metadata?: LogMetadata): void;
  close(): Promise<void>;
  context: LogContext;
  debug(message: string, metadata?: LogMetadata): void;
  error(message: string, metadata?: LogMetadata, error?: Error): void;

  // Core logging
  fatal(message: string, metadata?: LogMetadata, error?: Error): void;
  getContext(): LogContext;
  info(message: string, metadata?: LogMetadata): void;

  // Pediatric-specific
  patientFlow(patientId: string, action: string, metadata?: LogMetadata): void;
  performance(operation: string, duration: number, metadata?: LogMetadata): void;
  security(event: string, metadata?: LogMetadata): void;
  setContext(context: LogContext): void;
  trace(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  withRequest(req: IncomingMessage, res: ServerResponse): ILogger;
}
