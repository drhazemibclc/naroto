import logger from '@naroto/logger';

import { redisManager } from './client';
import { keys } from './config';

export interface RateLimitConfig {
  blockDuration?: number; // Block duration in seconds
  duration: number; // Time window in seconds
  points: number; // Number of requests allowed
}

export interface RateLimitResult {
  blocked?: boolean;
  remaining: number;
  reset: number;
  success: boolean;
  total: number;
}

class RateLimiter {
  private readonly defaultConfig: RateLimitConfig = {
    points: 100,
    duration: 60 // 1 minute
  };

  private readonly endpoints: Record<string, RateLimitConfig> = {
    // API endpoints
    'api:auth:login': { points: 5, duration: 300, blockDuration: 900 }, // 5 per 5min, block 15min
    'api:auth:register': { points: 3, duration: 3600, blockDuration: 86_400 }, // 3 per hour, block 24h
    'api:patient:create': { points: 20, duration: 3600 }, // 20 per hour
    'api:appointment:create': { points: 30, duration: 3600 }, // 30 per hour
    'api:appointment:list': { points: 100, duration: 60 }, // 100 per minute
    'api:patient:search': { points: 60, duration: 60 }, // 60 per minute

    // Public endpoints
    'public:health': { points: 30, duration: 60 }, // 30 per minute
    'public:metrics': { points: 10, duration: 60 }, // 10 per minute

    // GraphQL operations
    'graphql:query': { points: 200, duration: 60 }, // 200 per minute
    'graphql:mutation': { points: 50, duration: 60 } // 50 per minute
  };

  async check(key: string, config?: RateLimitConfig): Promise<RateLimitResult> {
    const client = redisManager.getClient();
    const now = Date.now();
    const windowKey = keys.rateLimit(key);

    const resolvedConfig = config || this.endpoints[key] || this.defaultConfig;
    const { points, duration, blockDuration } = resolvedConfig;

    try {
      // Check if currently blocked
      if (blockDuration) {
        const blockedKey = `${windowKey}:blocked`;
        const blocked = await client.get(blockedKey);
        if (blocked) {
          const ttl = await client.ttl(blockedKey);
          return {
            success: false,
            remaining: 0,
            reset: ttl,
            total: points,
            blocked: true
          };
        }
      }

      // Get current window data
      const windowData = await client.hgetall(windowKey);
      const count = Number.parseInt(windowData?.count || '0', 10);
      const firstRequest = Number.parseInt(windowData?.firstRequest || now.toString(), 10);

      // Check if window expired
      if (now - firstRequest > duration * 1000) {
        // Reset window
        const pipeline = client.pipeline();
        pipeline.hset(windowKey, 'count', 1);
        pipeline.hset(windowKey, 'firstRequest', now);
        pipeline.expire(windowKey, duration);
        await pipeline.exec();

        return {
          success: true,
          remaining: points - 1,
          reset: now + duration * 1000,
          total: points
        };
      }

      // Check if over limit
      if (count >= points) {
        if (blockDuration) {
          // Block the key
          const blockedKey = `${windowKey}:blocked`;
          await client.setex(blockedKey, blockDuration, '1');
        }

        const reset = firstRequest + duration * 1000;
        return {
          success: false,
          remaining: 0,
          reset,
          total: points
        };
      }

      // Increment counter
      await client.hincrby(windowKey, 'count', 1);

      const reset = firstRequest + duration * 1000;
      return {
        success: true,
        remaining: points - (count + 1),
        reset,
        total: points
      };
    } catch (error) {
      logger.error(`[RateLimit] Error checking key ${key}:`, { error });
      // Fail open in case of Redis error
      return {
        success: true,
        remaining: points,
        reset: now + duration * 1000,
        total: points
      };
    }
  }

  async checkIP(ip: string, endpoint: string, config?: RateLimitConfig): Promise<RateLimitResult> {
    const key = `ip:${ip}:${endpoint}`;
    return this.check(key, config);
  }

  async checkUser(userId: string, endpoint: string, config?: RateLimitConfig): Promise<RateLimitResult> {
    const key = `user:${userId}:${endpoint}`;
    return this.check(key, config);
  }

  async reset(key: string): Promise<void> {
    const client = redisManager.getClient();
    const windowKey = keys.rateLimit(key);
    const blockedKey = `${windowKey}:blocked`;

    const pipeline = client.pipeline();
    pipeline.del(windowKey);
    pipeline.del(blockedKey);
    await pipeline.exec();

    logger.debug(`[RateLimit] Reset key: ${key}`);
  }

  async getStats(key: string): Promise<{
    remaining: number;
    reset: number;
    total: number;
  } | null> {
    const client = redisManager.getClient();
    const windowKey = keys.rateLimit(key);

    const [count, firstRequest] = await Promise.all([
      client.hget(windowKey, 'count'),
      client.hget(windowKey, 'firstRequest')
    ]);

    if (!(count && firstRequest)) {
      return null;
    }

    const points = this.endpoints[key]?.points || this.defaultConfig.points;
    const duration = this.endpoints[key]?.duration || this.defaultConfig.duration;

    const remaining = points - Number.parseInt(count, 10);
    const reset = Number.parseInt(firstRequest, 10) + duration * 1000;

    return {
      remaining: Math.max(0, remaining),
      reset,
      total: points
    };
  }

  async getEndpointConfig(endpoint: string): Promise<RateLimitConfig> {
    return this.endpoints[endpoint] || this.defaultConfig;
  }
}

export const rateLimiter = new RateLimiter();
export default rateLimiter;
