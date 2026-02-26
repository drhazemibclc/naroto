/**
 * 🔄 Request Deduplication
 * Prevents duplicate queries (GET) within the same render pass.
 * Note: React `cache` is for Server Components, not Server Actions.
 */
import { cache } from 'react';

// Use a generic 'Args' array and 'Return' type to maintain full IntelliSense
export const dedupeQuery = <Args extends unknown[], Return>(
  fn: (...args: Args) => Promise<Return>
): ((...args: Args) => Promise<Return>) => {
  return cache(fn);
};

export const dedupeAction = <Args extends unknown[], Return>(
  fn: (...args: Args) => Promise<Return>
): ((...args: Args) => Promise<Return>) => {
  /**
   * Server Actions (POST) are not memoized by React `cache`.
   * We wrap this to provide a consistent API for logging or
   * future audit-logging (critical for HIPAA compliance).
   */
  return async (...args: Args): Promise<Return> => {
    // Add clinical logging/monitoring here if needed
    return fn(...args);
  };
};
