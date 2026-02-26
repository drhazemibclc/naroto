import { env } from '@naroto/env/server';
// import { dbLogger } from '@naroto/logger';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../generated/client';

/**
 * 1. Connection Pool Configuration
 * Using a getter or a constant to ensure the pool is managed correctly.
 */
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production',
  min: Number.parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
  max: Number.parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30_000
});

const adapter = new PrismaPg(pool);

/**
 * 2. Type-safe Global Singleton
 * This prevents creating a new connection on every Hot Module Replacement (HMR).
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'info' },
      { emit: 'event', level: 'warn' }
    ]
  });

// /**
//  * 3. Structured Logging
//  * Attaching listeners only once to the client.
//  */
// if (env.NODE_ENV === 'development') {
//   (prisma as PrismaClient).$on('query' as never, (e: Prisma.QueryEvent) => {
//     dbLogger.debug('Prisma Query', {
//       metadata: {
//         query: e.query,
//         params: e.params,
//         duration: `${e.duration}ms`
//       }
//     });
//   });
// }

// In development, save the instance to globalThis to prevent multiple instances
if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * 4. Exports & Helpers
 */
export const db = prisma;
export default prisma;

// /**
//  * Optimized Clinic Helper
//  * Improved type inference for the return type T.
//  */
// export async function withClinic<T>(clinicId: string, operation: () => Promise<T>): Promise<T> {
//   try {
//     return await operation();
//   } catch (error) {
//     dbLogger.error('Clinic Scoped Operation Failed', {
//       metadata: {
//         clinicId,
//         error: error instanceof Error ? error.message : error,
//         stack: error instanceof Error ? error.stack : undefined
//       }
//     });
//     throw error;
//   }
// }
