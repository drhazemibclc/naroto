// Internal logger instance
import { logger } from './logger';

export { logger, logger as default } from './logger';

console.log('Hello via pnpm!');

// Re-export everything else
export * from './formatters';
export { ConsoleTransport } from './transports/console';
export { FileTransport } from './transports/file';
export { SentryTransport } from './transports/sentry';
export * from './types';

// Create child loggers for specific contexts
export function createPatientLogger(patientId: string, clinicId?: string) {
  return logger.child({
    type: 'PATIENT_REGISTRATION',
    patientId,
    clinicId
  });
}

export function createClinicLogger(clinicId: string) {
  return logger.child({
    type: 'SYSTEM',
    clinicId
  });
}

export function createUserLogger(userId: string, clinicId?: string) {
  return logger.child({
    type: 'USER_ACTION',
    userId,
    clinicId
  });
}

// Pre-configured loggers for common modules
export const serverLogger = createClinicLogger('server');
export const dbLogger = createClinicLogger('db');
export const authLogger = createClinicLogger('auth');
export const wsLogger = createClinicLogger('ws');
export const aiLogger = createClinicLogger('ai');
export const trpcLogger = createClinicLogger('trpc');
export const schedulerLogger = createClinicLogger('scheduler');
export const videoLogger = createClinicLogger('video');
export const parserLogger = createClinicLogger('parser');
export const redisLogger = createClinicLogger('redis');
