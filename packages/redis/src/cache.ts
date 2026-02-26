import logger from '@naroto/logger';

import { redis } from './client';
import { cacheConfig, keys } from './config';
import type { CacheOptions } from './types';

class CacheManager {
  private readonly defaultTTL = cacheConfig.defaultTTL;

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      if (!data) {
        return null;
      }

      // Check if compressed
      if (data.startsWith('{')) {
        return JSON.parse(data) as T;
      }

      return data as T;
    } catch (error) {
      logger.error(`[Cache] Failed to get key ${key}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      const ttl = options.ttl || this.defaultTTL;
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);

      const pipeline = redis.pipeline();

      pipeline.set(key, serialized, 'EX', ttl);

      // Add tags for invalidation
      if (options.tags?.length) {
        for (const tag of options.tags) {
          pipeline.sadd(keys.cacheTag(tag), key);
          pipeline.expire(keys.cacheTag(tag), ttl);
        }
      }

      await pipeline.exec();

      logger.debug(`[Cache] Set key: ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      logger.error(`[Cache] Failed to set key ${key}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const results = await redis.mget(keys);
      return results.map(r => (r ? (JSON.parse(r) as T) : null));
    } catch (error) {
      logger.error('[Cache] Failed to mget:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return keys.map(() => null);
    }
  }

  async mset<T>(entries: [string, T][], ttl?: number): Promise<boolean> {
    try {
      const pipeline = redis.pipeline();

      for (const [key, value] of entries) {
        const serialized = JSON.stringify(value);
        pipeline.set(key, serialized, 'EX', ttl || this.defaultTTL);
      }

      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error('[Cache] Failed to mset:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const result = await redis.del(key);
      logger.debug(`[Cache] Deleted key: ${key}`);
      return result > 0;
    } catch (error) {
      logger.error(`[Cache] Failed to delete key ${key}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    try {
      const cacheKeys = await redis.smembers(keys.cacheTag(tag));

      if (cacheKeys.length > 0) {
        const pipeline = redis.pipeline();
        pipeline.del(...cacheKeys);
        pipeline.del(keys.cacheTag(tag));
        await pipeline.exec();

        logger.info(`[Cache] Invalidated ${cacheKeys.length} keys with tag: ${tag}`);
        return cacheKeys.length;
      }

      return 0;
    } catch (error) {
      logger.error(`[Cache] Failed to invalidate tag ${tag}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }

  async getOrSet<T>(key: string, fetcher: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      logger.debug(`[Cache] Hit: ${key}`);
      return cached;
    }

    logger.debug(`[Cache] Miss: ${key}`);
    const value = await fetcher();

    await this.set(key, value, options);
    return value;
  }

  async exists(key: string): Promise<boolean> {
    const result = await redis.exists(key);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    return await redis.ttl(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await redis.expire(key, seconds);
    return result === 1;
  }

  async persist(key: string): Promise<boolean> {
    const result = await redis.persist(key);
    return result === 1;
  }

  async increment(key: string, by = 1): Promise<number> {
    return await redis.incrby(key, by);
  }

  async decrement(key: string, by = 1): Promise<number> {
    return await redis.decrby(key, by);
  }

  async clearPattern(pattern: string): Promise<number> {
    try {
      let cursor = '0';
      let total = 0;

      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);

        if (keys.length > 0) {
          await redis.del(...keys);
          total += keys.length;
        }

        cursor = nextCursor;
      } while (cursor !== '0');

      logger.info(`[Cache] Cleared ${total} keys matching pattern: ${pattern}`);
      return total;
    } catch (error) {
      logger.error(`[Cache] Failed to clear pattern ${pattern}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }

  async health(): Promise<{ healthy: boolean; latency: number }> {
    const start = Date.now();
    try {
      await redis.ping();
      const latency = Date.now() - start;
      return { healthy: true, latency };
    } catch {
      return { healthy: false, latency: -1 };
    }
  }
}

export const cache = new CacheManager();
export default cache;
