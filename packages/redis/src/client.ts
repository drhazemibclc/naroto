import type { ConnectionOptions } from 'tls';

import logger from '@naroto/logger';
import Redis, { type RedisOptions } from 'ioredis';

import { redisConfig } from './config';
import type { RedisClient, RedisHealth } from './types';

// Top-level regex patterns for performance
const REDIS_VERSION_REGEX = /redis_version:(.+)/;
const REDIS_MODE_REGEX = /redis_mode:(.+)/;
const REDIS_ROLE_REGEX = /role:(.+)/;
const USED_MEMORY_REGEX = /used_memory:(\d+)/;
const PEAK_MEMORY_REGEX = /used_memory_peak:(\d+)/;
const FRAGMENTATION_REGEX = /mem_fragmentation_ratio:([\d.]+)/;
const TOTAL_CONNECTIONS_REGEX = /total_connections_received:(\d+)/;
const COMMANDS_PROCESSED_REGEX = /total_commands_processed:(\d+)/;
const EXPIRED_KEYS_REGEX = /expired_keys:(\d+)/;
const UPTIME_REGEX = /uptime_in_seconds:(\d+)/;

class RedisManager {
  private static instance: RedisManager;
  private readonly client: RedisClient;
  private readonly subscriber: RedisClient;
  private readonly publisher: RedisClient;
  private isConnected = false;

  private constructor() {
    this.client = this.createClient('main');
    this.subscriber = this.createClient('subscriber');
    this.publisher = this.createClient('publisher');

    this.setupEventHandlers();
  }

  static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  private createClient(name: string): RedisClient {
    const baseOptions = {
      ...redisConfig,
      lazyConnect: true,
      retryStrategy: (times: number): number | null => {
        if (times > 5) {
          logger.error(`[Redis:${name}] Max connection attempts reached`);
          return null;
        }

        const delay = Math.min(times * 100, 3000);
        logger.warn(`[Redis:${name}] Retrying connection in ${delay}ms (attempt ${times})`);
        return delay;
      }
    };

    // Create properly typed RedisOptions
    const options: RedisOptions = {
      host: baseOptions.host,
      port: baseOptions.port,
      password: baseOptions.password,
      db: baseOptions.db,
      keyPrefix: baseOptions.keyPrefix,
      maxRetriesPerRequest: baseOptions.maxRetriesPerRequest,
      enableReadyCheck: baseOptions.enableReadyCheck,
      lazyConnect: baseOptions.lazyConnect,
      retryStrategy: baseOptions.retryStrategy
    };

    // Normalize tls option: ioredis expects ConnectionOptions, not boolean
    if (typeof redisConfig.tls === 'boolean' && redisConfig.tls) {
      options.tls = {} as ConnectionOptions;
    }

    const client = new Redis(options);

    return client;
  }

  private setupEventHandlers(): void {
    const clients = [
      { client: this.client, name: 'main' },
      { client: this.subscriber, name: 'subscriber' },
      { client: this.publisher, name: 'publisher' }
    ];

    for (const { client, name } of clients) {
      client.on('connect', () => {
        logger.info(`[Redis:${name}] Connected`);
      });

      client.on('ready', () => {
        this.isConnected = true;
        logger.info(`[Redis:${name}] Ready`);
      });

      client.on('error', error => {
        logger.error(`[Redis:${name}] Error:`, {
          error: error instanceof Error ? error.message : String(error)
        });
      });

      client.on('close', () => {
        logger.warn(`[Redis:${name}] Connection closed`);
      });

      client.on('reconnecting', () => {
        logger.info(`[Redis:${name}] Reconnecting...`);
      });
    }
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await Promise.all([this.client.connect(), this.subscriber.connect(), this.publisher.connect()]);

      logger.info('[Redis] All clients connected');
    } catch (error) {
      logger.error('[Redis] Failed to connect:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([this.client.quit(), this.subscriber.quit(), this.publisher.quit()]);

      this.isConnected = false;
      logger.info('[Redis] Disconnected');
    } catch (error) {
      logger.error('[Redis] Failed to disconnect:', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  getClient(): RedisClient {
    return this.client;
  }

  getSubscriber(): RedisClient {
    return this.subscriber;
  }

  getPublisher(): RedisClient {
    return this.publisher;
  }

  async healthCheck(): Promise<RedisHealth> {
    const start = Date.now();

    try {
      await this.client.ping();
      const latency = Date.now() - start;

      const info = await this.client.info();
      const memory = await this.client.info('memory');
      const stats = await this.client.info('stats');

      // Parse Redis INFO response
      const version = info.match(REDIS_VERSION_REGEX)?.[1]?.trim() || 'unknown';
      const mode = info.match(REDIS_MODE_REGEX)?.[1]?.trim() || 'standalone';
      const role = (info.match(REDIS_ROLE_REGEX)?.[1]?.trim() as 'master' | 'slave') || 'master';

      const usedMemory = Number.parseInt(memory.match(USED_MEMORY_REGEX)?.[1] || '0', 10);
      const peakMemory = Number.parseInt(memory.match(PEAK_MEMORY_REGEX)?.[1] || '0', 10);
      const fragmentation = Number.parseFloat(memory.match(FRAGMENTATION_REGEX)?.[1] || '1');

      const totalConnections = Number.parseInt(stats.match(TOTAL_CONNECTIONS_REGEX)?.[1] || '0', 10);
      const commandsProcessed = Number.parseInt(stats.match(COMMANDS_PROCESSED_REGEX)?.[1] || '0', 10);
      const keysTotal = Number.parseInt((await this.client.dbsize()).toString(), 10);
      const keysExpired = Number.parseInt(stats.match(EXPIRED_KEYS_REGEX)?.[1] || '0', 10);
      const uptime = Number.parseInt(info.match(UPTIME_REGEX)?.[1] || '0', 10);

      return {
        status: latency < 100 ? 'healthy' : latency < 500 ? 'degraded' : 'down',
        latency,
        memory: {
          used: usedMemory,
          peak: peakMemory,
          fragmentation
        },
        stats: {
          totalConnections,
          activeConnections: await this.getActiveConnections(),
          commandsProcessed,
          keysTotal,
          keysExpired,
          uptime
        },
        version,
        mode,
        role
      };
    } catch (error) {
      logger.error('[Redis] Health check failed:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        status: 'down',
        latency: -1,
        memory: { used: 0, peak: 0, fragmentation: 0 },
        stats: {
          totalConnections: 0,
          activeConnections: 0,
          commandsProcessed: 0,
          keysTotal: 0,
          keysExpired: 0,
          uptime: 0
        },
        version: 'unknown',
        mode: 'unknown',
        role: 'master'
      };
    }
  }

  private async getActiveConnections(): Promise<number> {
    try {
      const clients = (await this.client.client('LIST')) as string;
      return clients.split('\n').length - 1;
    } catch {
      return 0;
    }
  }

  async flushDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot flush database in production');
    }
    await this.client.flushdb();
    logger.warn('[Redis] Database flushed');
  }

  async getStats(): Promise<Record<string, unknown>> {
    const info = await this.client.info();
    const sections: Record<string, unknown> = {};

    let currentSection = '';
    const lines = info.split('\n');

    for (const line of lines) {
      if (line.startsWith('#')) {
        currentSection = line.slice(2).toLowerCase();
        sections[currentSection] = {};
      } else if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (currentSection && key && value) {
          (sections[currentSection] as Record<string, unknown>)[key.trim()] = value.trim();
        }
      }
    }

    return sections;
  }
}
export const redisManager = RedisManager.getInstance();
// This is what you'll use for .get(), .set(), etc.
export const redis = redisManager.getClient();
export default redis;
