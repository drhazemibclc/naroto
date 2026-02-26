/**
 * 🔵 CACHE SERVICE
 * Centralized cache management with versioning and tagging
 */

import { logger } from '@naroto/logger';
import { redis } from '@naroto/redis';
import { CACHE_KEYS } from '@naroto/redis/cache-keys';

export class CacheService {
  private readonly CACHE_ENABLED = process.env.CACHE_ENABLED === 'true';

  /**
   * Get cached data with version check
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.CACHE_ENABLED) return null;

    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.warn('Cache get failed', { error, key });
      return null;
    }
  }

  /**
   * Set cached data with version tag
   */
  async set(key: string, value: unknown, ttl = 300): Promise<void> {
    if (!this.CACHE_ENABLED) return;

    try {
      await redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.warn('Cache set failed', { error, key });
    }
  }

  /**
   * Invalidate specific keys
   */
  async invalidate(...keys: string[]): Promise<void> {
    if (!this.CACHE_ENABLED || keys.length === 0) return;

    try {
      await redis.del(...keys);
      logger.debug('Cache invalidated', { keys });
    } catch (error) {
      logger.warn('Cache invalidation failed', { error, keys });
    }
  }

  /**
   * Invalidate by pattern (use with caution - can be slow on large datasets)
   */
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.CACHE_ENABLED) return;

    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.debug('Pattern cache invalidated', { pattern, count: keys.length });
      }
    } catch (error) {
      logger.warn('Pattern invalidation failed', { error, pattern });
    }
  }

  /**
   * Increment version for a clinic (invalidates all clinic caches)
   */
  async incrementClinicVersion(clinicId: string): Promise<void> {
    if (!this.CACHE_ENABLED) return;

    try {
      const versionKey = CACHE_KEYS.CLINIC_VERSION(clinicId);
      await redis.incr(versionKey);

      // Also tag-based invalidation
      await redis.sadd(CACHE_KEYS.TAGS.CLINIC(clinicId), versionKey);

      logger.debug('Clinic version incremented', { clinicId });
    } catch (error) {
      logger.warn('Failed to increment clinic version', { error, clinicId });
    }
  }

  /**
   * Get clinic version
   */
  async getClinicVersion(clinicId: string): Promise<number> {
    if (!this.CACHE_ENABLED) return 0;

    try {
      const version = await redis.get(CACHE_KEYS.CLINIC_VERSION(clinicId));
      return version ? Number.parseInt(version, 10) : 0;
    } catch (error) {
      logger.warn('Failed to get clinic version', { error, clinicId });
      return 0;
    }
  }

  /**
   * Build versioned cache key
   */
  buildVersionedKey(baseKey: string, version: number): string {
    return `${baseKey}:v${version}`;
  }

  /**
   * Invalidate all patient-related caches
   */
  async invalidatePatientCaches(patientId: string, clinicId: string): Promise<void> {
    if (!this.CACHE_ENABLED) return;

    const keys = [
      CACHE_KEYS.PATIENT_GROWTH(patientId),
      CACHE_KEYS.PATIENT_LATEST(patientId),
      CACHE_KEYS.PATIENT_GROWTH_CHART(patientId, 'weight'),
      CACHE_KEYS.PATIENT_GROWTH_CHART(patientId, 'height'),
      CACHE_KEYS.PATIENT_GROWTH_CHART(patientId, 'bmi')
    ];

    await this.invalidate(...keys);

    // Also invalidate clinic collections that might include this patient
    await this.invalidatePattern(CACHE_KEYS.CLINIC_GROWTH(clinicId).replace(/\*/g, '*'));
  }

  /**
   * Invalidate all clinic-related caches
   */
  async invalidateClinicCaches(clinicId: string): Promise<void> {
    if (!this.CACHE_ENABLED) return;

    await this.incrementClinicVersion(clinicId);
    await this.invalidatePattern(`${CACHE_KEYS.CLINIC_GROWTH(clinicId)}*`);
    await this.invalidatePattern(`${CACHE_KEYS.CLINIC_GROWTH_STATS(clinicId)}*`);
  }

  async healthCheck(): Promise<boolean> {
    if (!this.CACHE_ENABLED) return false;
    try {
      const result = await redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

// Export singleton
export const cacheService = new CacheService();
