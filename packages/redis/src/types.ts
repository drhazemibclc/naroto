import type { Job } from 'bullmq';
import type { Redis } from 'ioredis';

export interface RedisConfig {
  db?: number;
  enableReadyCheck?: boolean;
  host: string;
  keyPrefix?: string;
  lazyConnect?: boolean;
  maxRetriesPerRequest?: number;
  password?: string;
  port: number;
  retryStrategy?: (times: number) => number | null;
  tls?: boolean;
}

export interface RedisHealth {
  latency: number;
  memory: {
    used: number;
    peak: number;
    fragmentation: number;
  };
  mode: string;
  role: 'master' | 'slave';
  stats: {
    totalConnections: number;
    activeConnections: number;
    commandsProcessed: number;
    keysTotal: number;
    keysExpired: number;
    uptime: number;
  };
  status: 'healthy' | 'degraded' | 'down';
  version: string;
}

export interface CacheOptions {
  compress?: boolean;
  tags?: string[]; // Cache tags for invalidation
  ttl?: number; // Time to live in seconds
}

export interface QueueJob<T = unknown, R = unknown> {
  data: T;
  failedReason?: string;
  finishedAt?: Date;
  id: string;
  name: string;
  opts: {
    attempts: number;
    delay: number;
    priority: 'high' | 'medium' | 'low';
    timeout: number;
    timestamp: number;
  };
  processedAt?: Date;
  progress: number;
  result?: R;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
}

export type RedisClient = Redis;
export type RedisPipeline = ReturnType<Redis['pipeline']>;

// Job Type Definitions
export type JobType =
  | 'send-email'
  | 'send-sms'
  | 'send-notification'
  | 'process-appointment-reminder'
  | 'process-immunization-reminder'
  | 'process-followup-reminder'
  | 'generate-report'
  | 'generate-growth-chart'
  | 'export-records'
  | 'import-records'
  | 'backup-database'
  | 'cache-warm'
  | 'process-vitals'
  | 'calculate-growth-percentiles'
  | 'sync-calendar'
  | 'process-billing';

// Job Data Interfaces
export interface BaseJobData {
  clinicId?: string;
  metadata?: Record<string, unknown>;
  patientId?: string;
  userId?: string;
}

export interface SendEmailJobData extends BaseJobData {
  attachments?: Array<{ filename: string; content: Buffer | string }>;
  data: Record<string, unknown>;
  subject: string;
  template: string;
  to: string | string[];
}

export interface SendSMSJobData extends BaseJobData {
  message: string;
  priority?: 'high' | 'normal';
  to: string | string[];
}

export interface SendNotificationJobData extends BaseJobData {
  body: string;
  data?: Record<string, unknown>;
  title: string;
  type: 'in-app' | 'push' | 'email' | 'sms';
  userId: string;
}

export interface AppointmentReminderJobData extends BaseJobData {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  reminderType: '24h' | '2h' | '30m';
  startTime: Date;
}

export interface ImmunizationReminderJobData extends BaseJobData {
  childName: string;
  dueDate: Date;
  immunizationId: string;
  parentContact: string;
  patientId: string;
}

export interface GenerateReportJobData extends BaseJobData {
  format: 'pdf' | 'csv' | 'excel';
  params: Record<string, unknown>;
  reportId: string;
  type: 'patient-summary' | 'clinic-stats' | 'immunization-coverage' | 'financial';
  userId: string;
}

export interface ExportRecordsJobData extends BaseJobData {
  entityType: 'patients' | 'appointments' | 'medical-records';
  exportId: string;
  filters: Record<string, unknown>;
  format: 'csv' | 'json' | 'hl7';
  userId: string;
}

export interface ProcessVitalsJobData extends BaseJobData {
  patientId: string;
  vitals: Array<{
    type: string;
    value: number;
    unit: string;
    recordedAt: Date;
  }>;
}

export interface GrowthCalculationJobData extends BaseJobData {
  measurements: Array<{
    date: Date;
    weight?: number;
    height?: number;
    headCircumference?: number;
  }>;
  patientId: string;
}

export interface SyncCalendarJobData extends BaseJobData {
  action: 'sync' | 'push' | 'pull';
  lastSyncToken?: string;
  provider: 'google' | 'apple' | 'outlook';
  userId: string;
}

export type JobDataMap = {
  'send-email': SendEmailJobData;
  'send-sms': SendSMSJobData;
  'send-notification': SendNotificationJobData;
  'process-appointment-reminder': AppointmentReminderJobData;
  'process-immunization-reminder': ImmunizationReminderJobData;
  'process-followup-reminder': BaseJobData & { appointmentId: string };
  'generate-report': GenerateReportJobData;
  'generate-growth-chart': BaseJobData & { patientId: string; timeRange: string };
  'export-records': ExportRecordsJobData;
  'import-records': BaseJobData & { importId: string };
  'backup-database': BaseJobData & { backupId: string; type: 'full' | 'incremental' };
  'cache-warm': BaseJobData & { keys: string[] };
  'process-vitals': ProcessVitalsJobData;
  'calculate-growth-percentiles': GrowthCalculationJobData;
  'sync-calendar': SyncCalendarJobData;
  'process-billing': BaseJobData & { billingCycle: string };
};

// Job Result Type
export interface JobResult {
  completedAt: string;
  data?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
  processedAt: string;
  success: boolean;
}

// Queue Stats Type
export interface QueueStats {
  active: number;
  completed: number;
  delayed: number;
  failed: number;
  paused: boolean;
  total: number;
  waiting: number;
}

// Queue Manager Interface
export interface IQueueManager {
  addJob<T extends JobType>(type: T, data: JobDataMap[T], options?: JobOptions): Promise<Job<JobDataMap[T]>>;
  close(): Promise<void>;
  getJob<T extends JobType>(type: T, jobId: string): Promise<Job<JobDataMap[T]> | null>;
  getQueueStats(type: JobType): Promise<QueueStats | null>;
  pauseQueue(type: JobType): Promise<void>;
  removeJob(type: JobType, jobId: string): Promise<void>;
  resumeQueue(type: JobType): Promise<void>;
  retryFailedJobs(type: JobType): Promise<number>;
}

// Job Options
export interface JobOptions {
  attempts?: number;
  backoff?: number | { type: 'fixed' | 'exponential'; delay: number };
  delay?: number;
  priority?: 1 | 2 | 3 | 4 | 5; // 1 = highest, 5 = lowest
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
  repeat?: {
    pattern: string;
    limit?: number;
    every?: number;
  };
  timeout?: number;
}
