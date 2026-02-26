import logger from '@naroto/logger';

import { redisManager } from './client';
import { keys } from './config';

export type Channel = 'appointments' | 'patients' | 'notifications' | 'queue-updates' | 'realtime-stats';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface Message<T = unknown> {
  channel: Channel;
  clinicId?: string;
  data: T;
  event: string;
  timestamp: Date;
  userId?: string;
}

type MessageHandler<T = unknown> = (message: Message<T>) => void | Promise<void>;

class PubSubManager {
  private readonly handlers: Map<Channel, Set<MessageHandler<unknown>>> = new Map();

  private initialized = false;

  private resolveChannel(channel: Channel): string {
    const channelMap = keys.channel as Partial<Record<Channel, string>>;
    return channelMap[channel] ?? channel;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const subscriber = redisManager.getSubscriber();

    const channels: Channel[] = ['appointments', 'patients', 'notifications', 'queue-updates', 'realtime-stats'];

    for (const channel of channels) {
      const redisChannel = this.resolveChannel(channel);
      await subscriber.subscribe(redisChannel);
      logger.info(`[PubSub] Subscribed to channel: ${channel}`);
    }

    subscriber.on('message', (channelName: string, payload: string) => {
      void this.handleMessage(channelName, payload);
    });

    this.initialized = true;
  }

  private async handleMessage(_channelName: string, payload: string): Promise<void> {
    try {
      const parsed = JSON.parse(payload) as Message<unknown>;
      const handlers = this.handlers.get(parsed.channel);

      if (!handlers || handlers.size === 0) {
        return;
      }

      logger.debug(`[PubSub] Received message on ${parsed.channel}: ${parsed.event}`);

      const executions = Array.from(handlers).map(handler =>
        Promise.resolve(handler(parsed)).catch((error: unknown) => {
          logger.error(`[PubSub] Handler error for ${parsed.channel}`, error instanceof Error ? { error } : undefined);
        })
      );

      await Promise.all(executions);
    } catch (error: unknown) {
      logger.error('[PubSub] Error handling message', error instanceof Error ? { error } : undefined);
    }
  }

  async publish<T>(
    channel: Channel,
    event: string,
    data: T,
    metadata?: { userId?: string; clinicId?: string }
  ): Promise<void> {
    try {
      const message: Message<T> = {
        channel,
        event,
        data,
        timestamp: new Date(),
        ...metadata
      };

      const publisher = redisManager.getPublisher();
      const redisChannel = this.resolveChannel(channel);

      await publisher.publish(redisChannel, JSON.stringify(message));

      logger.debug(`[PubSub] Published to ${channel}: ${event}`);
    } catch (error: unknown) {
      logger.error(`[PubSub] Error publishing to ${channel}`, error instanceof Error ? { error } : undefined);
    }
  }

  subscribe<T = unknown>(channel: Channel, handler: MessageHandler<T>): () => void {
    const existing = this.handlers.get(channel);

    if (existing) {
      existing.add(handler as MessageHandler<unknown>);
    } else {
      this.handlers.set(channel, new Set([handler as MessageHandler<unknown>]));
    }

    logger.debug(`[PubSub] Subscribed handler to ${channel}`);

    return () => {
      const current = this.handlers.get(channel);
      if (!current) {
        return;
      }

      current.delete(handler as MessageHandler<unknown>);
      logger.debug(`[PubSub] Unsubscribed handler from ${channel}`);
    };
  }

  async publishAppointmentUpdate(appointmentId: string, status: string, clinicId: string): Promise<void> {
    await this.publish('appointments', 'update', {
      appointmentId,
      status,
      clinicId,
      timestamp: new Date()
    });
  }

  async publishPatientUpdate(
    patientId: string,
    event: 'created' | 'updated' | 'deleted',
    clinicId: string
  ): Promise<void> {
    await this.publish('patients', event, {
      patientId,
      clinicId,
      timestamp: new Date()
    });
  }

  async publishNotification(userId: string, title: string, message: string, type: string): Promise<void> {
    await this.publish('notifications', 'new', {
      userId,
      title,
      message,
      type,
      timestamp: new Date()
    });
  }

  async publishQueueUpdate(queueId: string, patientId: string, status: string): Promise<void> {
    await this.publish('queue-updates', 'status-change', {
      queueId,
      patientId,
      status,
      timestamp: new Date()
    });
  }

  async publishStatsUpdate(clinicId: string, stats: Record<string, JsonValue>): Promise<void> {
    await this.publish('realtime-stats', 'update', {
      clinicId,
      stats,
      timestamp: new Date()
    });
  }

  async getChannelSubscribers(channel: Channel): Promise<number> {
    const publisher = redisManager.getPublisher();
    const redisChannel = this.resolveChannel(channel);

    const result = (await publisher.call('PUBSUB', 'NUMSUB', redisChannel)) as unknown[];

    const count = typeof result?.[1] === 'number' ? result[1] : Number.parseInt(String(result?.[1] ?? '0'), 10);

    return Number.isNaN(count) ? 0 : count;
  }

  async listChannels(): Promise<Channel[]> {
    const publisher = redisManager.getPublisher();

    const result = (await publisher.call('PUBSUB', 'CHANNELS')) as unknown[];

    return result.filter((c): c is string => typeof c === 'string').map(c => c.replace('channel:', '') as Channel);
  }
}

export const pubsub = new PubSubManager();
export default pubsub;
