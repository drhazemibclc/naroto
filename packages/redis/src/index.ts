export { default as cache } from './cache';
export { redis as default, default as redis } from './client';
export * from './config';
export { default as pubsub } from './pubsub';
export { queueManager } from './queue';
export { default as rateLimiter } from './rate-limit';
export { default as sessionManager } from './session';
export type {
  CacheOptions,
  QueueJob,
  RedisClient,
  RedisHealth
} from './types';
// Re-export commonly used types
export * from './types';

// Convenience exports
export const redisKeys = (await import('./config')).keys;
export const redisConfig = (await import('./config')).default;

// Initialize function
export async function initializeRedis(): Promise<void> {
  const { redis } = await import('./client');
  const { pubsub } = await import('./pubsub');

  await redis.connect();
  await pubsub.initialize();

  console.log('[Redis] Initialized successfully');
}

// Health check
export async function healthCheck() {
  const { redisManager } = await import('./client');
  return redisManager.healthCheck();
}
