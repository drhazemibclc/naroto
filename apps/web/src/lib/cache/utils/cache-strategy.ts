// lib/cache-strategy.ts
import { cacheLife, cacheTag, revalidateTag, updateTag } from 'next/cache';

import { type CacheProfile, cacheProfiles } from './profiles';

// Generate consistent cache key
export function generateCacheKey(prefix: string, clinicId: string, ...args: unknown[]): string {
  return `${prefix}:${clinicId}:${JSON.stringify(args)}`;
}

// Core caching wrapper
// Core caching wrapper
export function withCache<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  options: {
    tags?: string[];
    profile: CacheProfile;
    prefix: string;
  }
): (...args: Args) => Promise<R> {
  return async (...args: Args): Promise<R> => {
    'use cache';

    const { tags = [], profile, prefix } = options;

    // Apply cache duration
    cacheLife(cacheProfiles[profile]);

    // Apply tags (no return inside forEach)
    for (const tag of tags) {
      cacheTag(tag);
    }

    // Derive clinicId from first argument if it has clinicId, else 'global'
    const firstArg = args[0] as { clinicId?: string } | undefined;
    const clinicId = firstArg?.clinicId ?? 'global';
    const cacheKey = generateCacheKey(prefix, clinicId, ...args);

    // Tag the specific key for fine-grained invalidation
    cacheTag(cacheKey);

    return fn(...args);
  };
}

// Force immediate cache update for specific tags
export function updateCache(tags: string | string[]) {
  const tagList = Array.isArray(tags) ? tags : [tags];
  for (const tag of tagList) {
    cacheTag(tag); // tag again before updating
    updateTag(tag);
  }
}

// Revalidate cache (stale-while-revalidate) for specific tags
export function revalidateCache(tags: string | string[]): void {
  const tagList = Array.isArray(tags) ? tags : [tags];

  for (const tag of tagList) {
    revalidateTag(tag, 'max');
  }
}
