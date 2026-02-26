import logger from '@naroto/logger';
import type { RedisConfig } from './types';

// const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

export const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: Number.parseInt(process.env.REDIS_DB || '0', 10),
  keyPrefix: process.env.REDIS_PREFIX || 'pediacare:',
  tls: process.env.REDIS_TLS === 'true',
  maxRetriesPerRequest: 3,
 retryStrategy: (times: number) => {
     if (times > 10) {
       logger.error('Redis max retries reached')
       return null
     }
   const delay = Math.min(times * 50, 2000);
    return delay;
  },
  enableReadyCheck: true,
  lazyConnect: isTest
}as const

export const cacheConfig = {
  defaultTTL: 3600, // 1 hour
  patientTTL: 300, // 5 minutes
  sessionTTL: 86_400, // 24 hours
  queueTTL: 604_800, // 7 days
  rateLimitTTL: 60 // 1 minute
};

export const queueConfig = {
  defaultAttempts: 3,
  defaultTimeout: 30_000, // 30 seconds
    defaultBackoff: 5000, // 5 seconds

 concurrency: {
    'email': 5,
    'notification': 10,
    'reminder': 10,
    'report': 2,
    'export': 1,
    'backup': 1,
    'cache-warm': 3,
    'growth-calculation': 5,
  },
  retention: {
    completed: 24 * 60 * 60 * 1000, // 24 hours
    failed: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
    limiter: {
    max: 100,
    duration: 1000
  }
} as const

export const keys = {
  // Patient-related keys
  patient: (id: string) => `patient:${id}`,
  patientList: (clinicId: string) => `patients:${clinicId}`,
  patientAppointments: (patientId: string) => `patient:${patientId}:appointments`,
  patientRecords: (patientId: string) => `patient:${patientId}:records`,

  // Queue keys
  queue: (name: string) => `queue:${name}`,
  queueJob: (queue: string, id: string) => `queue:${queue}:job:${id}`,

  // Session keys
  session: (id: string) => `session:${id}`,
  userSessions: (userId: string) => `user:${userId}:sessions`,

  // Rate limiting
  rateLimit: (key: string) => `ratelimit:${key}`,

  // Cache keys
  cache: (key: string) => `cache:${key}`,
  cacheTag: (tag: string) => `cache:tag:${tag}`,

  // Pub/Sub channels
  channel: {
    appointments: 'channel:appointments',
    patients: 'channel:patients',
    notifications: 'channel:notifications',
    queue: (id: string) => `channel:queue:${id}`
  },

  // Locks
  lock: (key: string) => `lock:${key}`,

  // Counters
  counter: (name: string) => `counter:${name}`,
  dailyStats: (date: string) => `stats:daily:${date}`,
  monthlyStats: (month: string) => `stats:monthly:${month}`
};

export default {
  redis: redisConfig,
  cache: cacheConfig,
  queue: queueConfig,
  keys
};
