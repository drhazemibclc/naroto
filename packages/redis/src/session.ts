import logger from '@naroto/logger';
import { RedisStore } from 'connect-redis';
import type { RequestHandler } from 'express';
import session from 'express-session';

import { redis } from './client';
import { keys } from './config';

export interface SessionData {
  clinicId?: string;
  ipAddress?: string;
  lastActivity: Date;
  metadata?: Record<string, unknown>;
  permissions: string[];
  role: string;
  userAgent?: string;
  userId: string;
}

class SessionManager {
  private readonly store: RedisStore;
  private readonly sessionTTL = 86_400; // 24h

  constructor() {
    this.store = new RedisStore({
      client: redis,
      prefix: keys.session(''),
      ttl: this.sessionTTL,
      disableTouch: false,
      disableTTL: false,
      scanCount: 100,
      serializer: {
        parse: (text: string) => JSON.parse(text),
        stringify: (obj: unknown) => JSON.stringify(obj)
      }
    });
  }

  getStore(): RedisStore {
    return this.store;
  }

  // ✅ FIX 1 — Correct RequestHandler typing
  getSessionMiddleware(): RequestHandler {
    return session({
      store: this.store as unknown as session.Store,
      secret: process.env.SESSION_SECRET ?? 'pediacare-secret',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        maxAge: this.sessionTTL * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      },
      name: 'pediacare.sid'
    }) as unknown as RequestHandler;
  }

  async createSession(sessionId: string, data: SessionData): Promise<void> {
    const client = redis;
    const key = keys.session(sessionId);
    const userSessionsKey = keys.userSessions(data.userId);

    const pipeline = client.pipeline();

    pipeline.setex(
      key,
      this.sessionTTL,
      JSON.stringify({
        ...data,
        lastActivity: new Date()
      })
    );

    pipeline.sadd(userSessionsKey, sessionId);
    pipeline.expire(userSessionsKey, this.sessionTTL);

    await pipeline.exec();

    logger.info(`[Session] Created session ${sessionId} for user ${data.userId}`);
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const client = redis;
      const key = keys.session(sessionId);

      const data = await client.get(key);
      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data) as SessionData;

      await this.touchSession(sessionId);
      return parsed;
    } catch (error: unknown) {
      logger.error(`[Session] Failed to get session ${sessionId}`, error instanceof Error ? { error } : undefined);
      return null;
    }
  }

  async updateSession(sessionId: string, data: Partial<SessionData>): Promise<boolean> {
    try {
      const client = redis;
      const key = keys.session(sessionId);

      const existing = await this.getSession(sessionId);
      if (!existing) {
        return false;
      }

      const updated: SessionData = {
        ...existing,
        ...data,
        lastActivity: new Date()
      };

      await client.setex(key, this.sessionTTL, JSON.stringify(updated));

      logger.debug(`[Session] Updated session ${sessionId}`);
      return true;
    } catch (error: unknown) {
      logger.error(`[Session] Failed to update session ${sessionId}`, error instanceof Error ? { error } : undefined);
      return false;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const client = redis;
      const key = keys.session(sessionId);

      const sessionData = await this.getSession(sessionId);

      const pipeline = client.pipeline();
      pipeline.del(key);

      if (sessionData?.userId) {
        pipeline.srem(keys.userSessions(sessionData.userId), sessionId);
      }

      await pipeline.exec();

      logger.info(`[Session] Deleted session ${sessionId}`);
      return true;
    } catch (error: unknown) {
      logger.error(`[Session] Failed to delete session ${sessionId}`, error instanceof Error ? { error } : undefined);
      return false;
    }
  }

  async deleteUserSessions(userId: string): Promise<number> {
    try {
      const client = redis;
      const userSessionsKey = keys.userSessions(userId);

      const sessionIds = await client.smembers(userSessionsKey);

      if (sessionIds.length) {
        const pipeline = client.pipeline();

        for (const id of sessionIds) {
          pipeline.del(keys.session(id));
        }

        pipeline.del(userSessionsKey);
        await pipeline.exec();
      }

      logger.info(`[Session] Deleted ${sessionIds.length} sessions for user ${userId}`);

      return sessionIds.length;
    } catch (error: unknown) {
      logger.error(
        `[Session] Failed to delete user sessions for ${userId}`,
        error instanceof Error ? { error } : undefined
      );
      return 0;
    }
  }

  async touchSession(sessionId: string): Promise<boolean> {
    try {
      const client = redis;
      await client.expire(keys.session(sessionId), this.sessionTTL);
      return true;
    } catch (error: unknown) {
      logger.error(`[Session] Failed to touch session ${sessionId}`, error instanceof Error ? { error } : undefined);
      return false;
    }
  }

  async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const client = redis;
      const userSessionsKey = keys.userSessions(userId);

      const sessionIds = await client.smembers(userSessionsKey);
      const sessions = await Promise.all(sessionIds.map(id => this.getSession(id)));

      return sessions.filter((s): s is SessionData => s !== null);
    } catch (error: unknown) {
      logger.error(
        `[Session] Failed to get user sessions for ${userId}`,
        error instanceof Error ? { error } : undefined
      );
      return [];
    }
  }

  // ✅ FIX 2 — Remove shadowed `keys` variable
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const client = redis;
      let cursor = '0';
      let cleaned = 0;

      do {
        const [nextCursor, foundKeys] = await client.scan(cursor, 'MATCH', keys.session('*'), 'COUNT', 100);

        for (const redisKey of foundKeys) {
          const exists = await client.exists(redisKey);

          if (!exists) {
            cleaned++;
          }
        }

        cursor = nextCursor;
      } while (cursor !== '0');

      logger.info(`[Session] Cleaned up ${cleaned} expired sessions`);
      return cleaned;
    } catch (error: unknown) {
      logger.error('[Session] Failed to cleanup expired sessions', error instanceof Error ? { error } : undefined);
      return 0;
    }
  }

  async getActiveSessionsCount(): Promise<number> {
    try {
      const client = redis;
      let cursor = '0';
      let count = 0;

      do {
        const [nextCursor, foundKeys] = await client.scan(cursor, 'MATCH', keys.session('*'), 'COUNT', 1000);

        count += foundKeys.length;
        cursor = nextCursor;
      } while (cursor !== '0');

      return count;
    } catch (error: unknown) {
      logger.error('[Session] Failed to get active sessions count', error instanceof Error ? { error } : undefined);
      return 0;
    }
  }
}

export const sessionManager = new SessionManager();
export default sessionManager;
