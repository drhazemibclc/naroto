import { logger as baseLogger } from '@naroto/logger';
import { type Job, Queue, Worker } from 'bullmq';

import { redisManager } from './client';
import { queueConfig } from './config';
import type { BaseJobData, JobDataMap, JobOptions, JobResult, JobType, QueueStats } from './types';

const logger = baseLogger.child({ module: 'queue' });

// Job Handlers Map
type JobHandler = (data: JobDataMap[JobType], job: Job) => Promise<unknown>;

class JobQueueManager {
  private readonly queues: Map<JobType, Queue> = new Map();
  private readonly workers: Map<JobType, Worker> = new Map();
  private readonly handlers: Map<JobType, JobHandler> = new Map();
  private isShuttingDown = false;
  private isInitialized = false;
  private initializationAttempted = false;

  constructor() {
    this.registerHandlers();
    this.setupGracefulShutdown();
  }

  /**
   * Register all job handlers
   */
  private registerHandlers() {
    // Email handlers
    this.handlers.set('send-email', this.handleSendEmail.bind(this) as unknown as JobHandler);
    this.handlers.set('send-sms', this.handleSendSMS.bind(this) as unknown as JobHandler);
    this.handlers.set('send-notification', this.handleSendNotification.bind(this) as unknown as JobHandler);

    // Reminder handlers
    this.handlers.set(
      'process-appointment-reminder',
      this.handleAppointmentReminder.bind(this) as unknown as JobHandler
    );
    this.handlers.set(
      'process-immunization-reminder',
      this.handleImmunizationReminder.bind(this) as unknown as JobHandler
    );
    this.handlers.set('process-followup-reminder', this.handleFollowupReminder.bind(this) as unknown as JobHandler);

    // Report handlers
    this.handlers.set('generate-report', this.handleGenerateReport.bind(this) as unknown as JobHandler);
    this.handlers.set('generate-growth-chart', this.handleGenerateGrowthChart.bind(this) as unknown as JobHandler);
    this.handlers.set('export-records', this.handleExportRecords.bind(this) as unknown as JobHandler);
    this.handlers.set('import-records', this.handleImportRecords.bind(this) as unknown as JobHandler);

    // System handlers
    this.handlers.set('backup-database', this.handleBackupDatabase.bind(this) as unknown as JobHandler);
    this.handlers.set('cache-warm', this.handleCacheWarm.bind(this) as unknown as JobHandler);
    this.handlers.set('process-vitals', this.handleProcessVitals.bind(this) as unknown as JobHandler);
    this.handlers.set('calculate-growth-percentiles', this.handleGrowthCalculation.bind(this) as unknown as JobHandler);
    this.handlers.set('sync-calendar', this.handleSyncCalendar.bind(this) as unknown as JobHandler);
    this.handlers.set('process-billing', this.handleProcessBilling.bind(this) as unknown as JobHandler);
  }

  /**
   * Initialize queues - must be called explicitly
   */
  async initialize(): Promise<void> {
    if (this.initializationAttempted) {
      return;
    }

    this.initializationAttempted = true;

    // Skip initialization in certain environments
    if (this.shouldSkipInitialization()) {
      logger.info('Skipping queue initialization (CLI/SKIP_INIT mode)');
      return;
    }

    try {
      // Test Redis connection first
      await this.testRedisConnection();

      const jobTypes: JobType[] = [
        'send-email',
        'send-sms',
        'send-notification',
        'process-appointment-reminder',
        'process-immunization-reminder',
        'process-followup-reminder',
        'generate-report',
        'generate-growth-chart',
        'export-records',
        'import-records',
        'backup-database',
        'cache-warm',
        'process-vitals',
        'calculate-growth-percentiles',
        'sync-calendar',
        'process-billing'
      ];

      let successCount = 0;
      for (const type of jobTypes) {
        const success = await this.setupQueue(type);
        if (success) successCount++;
      }

      this.isInitialized = true;
      logger.info(`Initialized ${successCount}/${jobTypes.length} queues successfully`);
    } catch (error) {
      logger.error('Failed to initialize queues', { error });
      // Don't throw - allow application to continue without queues
    }
  }

  /**
   * Check if queue initialization should be skipped
   */
  private shouldSkipInitialization(): boolean {
    // Skip in CLI scripts (like seeds)
    if (process.argv.some(arg => arg.includes('seed') || arg.includes('migrate') || arg.includes('studio'))) {
      return true;
    }

    // Skip if explicitly disabled
    if (process.env.SKIP_QUEUE_INIT === 'true') {
      return true;
    }

    // Skip in test environment
    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    return false;
  }

  /**
   * Test Redis connection
   */
  private async testRedisConnection(): Promise<void> {
    try {
      const client = redisManager.getClient();
      await client.ping();
      logger.debug('Redis connection successful');
    } catch (error) {
      logger.error('Redis connection failed', { error });
      throw new Error('Redis connection failed - queues cannot be initialized');
    }
  }

  /**
   * Setup individual queue with worker and scheduler
   */
  private async setupQueue(type: JobType): Promise<boolean> {
    const queueName = `queue:${type}`;
    const concurrency = this.getConcurrency(type);
    const handler = this.handlers.get(type);

    if (!handler) {
      logger.warn('No handler registered for job type', { jobType: type });
      return false;
    }

    try {
      // Create queue
      const queue = new Queue(queueName, {
        connection: redisManager.getClient(),
        defaultJobOptions: {
          attempts: queueConfig.defaultAttempts,
          backoff: {
            type: 'exponential',
            delay: queueConfig.defaultBackoff
          },
          removeOnComplete: queueConfig.retention.completed,
          removeOnFail: queueConfig.retention.failed
        }
      });

      // Wait for queue to be ready
      await queue.waitUntilReady();
      this.queues.set(type, queue);

      // Create worker with processor
      const worker = new Worker(
        queueName,
        async job => {
          const startTime = Date.now();

          try {
            logger.info('Processing job', {
              jobId: job.id,
              jobType: job.name as JobType,
              attemptsMade: job.attemptsMade
            });

            // Execute the handler
            const result = await handler(job.data, job);

            const duration = Date.now() - startTime;
            logger.info('Job completed successfully', {
              jobId: job.id,
              jobType: job.name as JobType,
              duration
            });

            return {
              success: true,
              processedAt: new Date(startTime).toISOString(),
              completedAt: new Date().toISOString(),
              data: result
            } as JobResult;
          } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('Job failed', {
              error,
              jobId: job.id,
              jobType: job.name as JobType,
              duration,
              attemptsMade: job.attemptsMade
            });

            throw error; // BullMQ will handle retries
          }
        },
        {
          connection: redisManager.getClient(),
          concurrency,
          lockDuration: 60_000, // 1 minute
          stalledInterval: 30_000, // Check for stalled jobs every 30 seconds
          maxStalledCount: 2 // Max number of times a job can be stalled
        }
      );

      // Wait for worker to be ready
      await worker.waitUntilReady();

      // Worker event handlers
      worker.on('completed', job => {
        logger.debug('Job completed event', { jobId: job.id, jobType: job.name as JobType });
      });

      worker.on('failed', (job, error) => {
        if (job) {
          logger.error('Job failed event', {
            error,
            jobId: job.id,
            jobType: job.name as JobType,
            attemptsMade: job.attemptsMade
          });
        }
      });

      worker.on('error', error => {
        logger.error('Worker error', { error, jobType: type });
      });

      worker.on('stalled', jobId => {
        logger.warn('Job stalled', { jobId, jobType: type });
      });

      worker.on('progress', (jobId, progress) => {
        logger.debug('Job progress event', { jobId, progress, jobType: type });
      });

      worker.on('paused', () => {
        logger.info('Worker paused', { jobType: type });
      });

      worker.on('resumed', () => {
        logger.info('Worker resumed', { jobType: type });
      });

      this.workers.set(type, worker);

      logger.debug('Queue setup complete', { jobType: type, concurrency });
      return true;
    } catch (error) {
      logger.error('Failed to setup queue', { error, jobType: type });
      return false;
    }
  }

  /**
   * Add a job to the queue
   */
  async addJob<T extends JobType>(type: T, data: JobDataMap[T], options: JobOptions = {}): Promise<Job<JobDataMap[T]>> {
    // Auto-initialize if not already done
    if (!this.initializationAttempted) {
      await this.initialize();
    }

    if (!this.isInitialized) {
      throw new Error('Queue manager is not initialized');
    }

    if (this.isShuttingDown) {
      throw new Error('Queue manager is shutting down');
    }

    const queue = this.queues.get(type);
    if (!queue) {
      throw new Error(`Queue for type ${type} not found or not initialized`);
    }

    const jobOptions = {
      attempts: options.attempts ?? queueConfig.defaultAttempts,
      backoff: options.backoff ?? { type: 'exponential', delay: queueConfig.defaultBackoff },
      delay: options.delay,
      repeat: options.repeat,
      priority: options.priority ?? this.getPriority(type),
      removeOnComplete: options.removeOnComplete ?? queueConfig.retention.completed,
      removeOnFail: options.removeOnFail ?? queueConfig.retention.failed,
      timeout: options.timeout ?? queueConfig.defaultTimeout
    };

    // Add metadata
    const enrichedData = {
      ...data,
      metadata: {
        ...((data as BaseJobData).metadata || {}),
        queuedAt: new Date().toISOString(),
        environment: process.env.NODE_ENV
      }
    };

    const job = await queue.add(type, enrichedData, jobOptions);

    logger.info('Job added to queue', {
      jobId: job.id,
      jobType: type,
      priority: jobOptions.priority,
      attempts: jobOptions.attempts,
      delay: jobOptions.delay,
      repeat: jobOptions.repeat ? 'yes' : 'no'
    });

    return job as Job<JobDataMap[T]>;
  }

  /**
   * Get a job by ID
   */
  async getJob<T extends JobType>(type: T, jobId: string): Promise<Job<JobDataMap[T]> | null> {
    const queue = this.queues.get(type);
    if (!queue) return null;

    try {
      const job = await queue.getJob(jobId);
      return job as Job<JobDataMap[T]> | null;
    } catch (error) {
      logger.error('Failed to get job', { error, jobType: type, jobId });
      return null;
    }
  }

  /**
   * Remove a job
   */
  async removeJob(type: JobType, jobId: string): Promise<void> {
    const queue = this.queues.get(type);
    if (!queue) return;

    try {
      const job = await queue.getJob(jobId);
      if (job) {
        await job.remove();
        logger.info('Job removed', { jobType: type, jobId });
      }
    } catch (error) {
      logger.error('Failed to remove job', { error, jobType: type, jobId });
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(type: JobType): Promise<QueueStats | null> {
    const queue = this.queues.get(type);
    if (!queue) return null;

    try {
      const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused()
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused: isPaused,
        total: waiting + active + completed + failed + delayed
      };
    } catch (error) {
      logger.error('Failed to get queue stats', { error, jobType: type });
      return null;
    }
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(
    type: JobType,
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
    start = 0,
    end = 10
  ) {
    const queue = this.queues.get(type);
    if (!queue) return [];

    try {
      switch (status) {
        case 'waiting':
          return queue.getWaiting(start, end);
        case 'active':
          return queue.getActive(start, end);
        case 'completed':
          return queue.getCompleted(start, end);
        case 'failed':
          return queue.getFailed(start, end);
        case 'delayed':
          return queue.getDelayed(start, end);
        default:
          return [];
      }
    } catch (error) {
      logger.error('Failed to get jobs', { error, jobType: type, status });
      return [];
    }
  }

  /**
   * Pause queue
   */
  async pauseQueue(type: JobType): Promise<void> {
    const queue = this.queues.get(type);
    if (!queue) return;

    try {
      await queue.pause();
      logger.info('Queue paused', { jobType: type });
    } catch (error) {
      logger.error('Failed to pause queue', { error, jobType: type });
    }
  }

  /**
   * Resume queue
   */
  async resumeQueue(type: JobType): Promise<void> {
    const queue = this.queues.get(type);
    if (!queue) return;

    try {
      await queue.resume();
      logger.info('Queue resumed', { jobType: type });
    } catch (error) {
      logger.error('Failed to resume queue', { error, jobType: type });
    }
  }

  /**
   * Retry all failed jobs
   */
  async retryFailedJobs(type: JobType): Promise<number> {
    const queue = this.queues.get(type);
    if (!queue) return 0;

    try {
      const failed = await queue.getFailed();
      let retried = 0;

      for (const job of failed) {
        try {
          await job.retry();
          retried++;
        } catch (error) {
          logger.error('Failed to retry job', { error, jobType: type, jobId: job.id });
        }
      }

      logger.info('Retried failed jobs', { jobType: type, count: retried });
      return retried;
    } catch (error) {
      logger.error('Failed to retry jobs', { error, jobType: type });
      return 0;
    }
  }

  /**
   * Clean old jobs
   */
  async cleanQueue(
    type: JobType,
    gracePeriod: number = 24 * 60 * 60 * 1000, // 24 hours default
    limit = 1000
  ): Promise<void> {
    const queue = this.queues.get(type);
    if (!queue) return;

    try {
      const [completed, failed] = await Promise.all([
        queue.clean(gracePeriod, limit, 'completed'),
        queue.clean(gracePeriod, limit, 'failed')
      ]);

      logger.info('Cleaned old jobs', {
        jobType: type,
        completedRemoved: completed.length,
        failedRemoved: failed.length
      });
    } catch (error) {
      logger.error('Failed to clean queue', { error, jobType: type });
    }
  }

  /**
   * Get job priority based on type
   */
  private getPriority(type: JobType): 1 | 2 | 3 | 4 | 5 {
    const priorityMap: Partial<Record<JobType, 1 | 2 | 3 | 4 | 5>> = {
      'process-appointment-reminder': 1,
      'process-immunization-reminder': 1,
      'send-notification': 2,
      'send-email': 3,
      'send-sms': 3,
      'process-vitals': 3,
      'calculate-growth-percentiles': 4,
      'generate-report': 4,
      'export-records': 5,
      'backup-database': 5
    };

    return priorityMap[type] || 3;
  }

  /**
   * Get worker concurrency based on job type
   */
  private getConcurrency(type: JobType): number {
    const concurrencyMap: Partial<Record<JobType, number>> = {
      'send-email': 5,
      'send-sms': 10,
      'send-notification': 10,
      'process-appointment-reminder': 10,
      'process-immunization-reminder': 10,
      'process-followup-reminder': 10,
      'generate-report': 2,
      'generate-growth-chart': 3,
      'export-records': 1,
      'import-records': 1,
      'backup-database': 1,
      'cache-warm': 3,
      'process-vitals': 5,
      'calculate-growth-percentiles': 5,
      'sync-calendar': 2,
      'process-billing': 1
    };

    return concurrencyMap[type] || 3;
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown() {
    const shutdown = async () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      logger.info('Shutting down queue manager...');

      try {
        await this.close();
        logger.info('Queue manager shutdown complete');
      } catch (error) {
        logger.error('Error during queue manager shutdown', { error });
      }
    };

    // Remove existing listeners to avoid memory leaks
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  /**
   * Close all queues, workers, and schedulers
   */
  async close(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    logger.info('Closing all queue resources...');

    const closePromises: Promise<void>[] = [];

    // Close workers
    for (const [type, worker] of this.workers) {
      closePromises.push(
        worker.close().catch(error => {
          logger.error('Error closing worker', { error, jobType: type });
        })
      );
    }

    // Close queues
    for (const [type, queue] of this.queues) {
      closePromises.push(
        queue.close().catch(error => {
          logger.error('Error closing queue', { error, jobType: type });
        })
      );
    }

    await Promise.all(closePromises);

    this.queues.clear();
    this.workers.clear();
    this.isInitialized = false;

    logger.info('All queue resources closed');
  }

  /**
   * Check if queue manager is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      // Test Redis connection
      await redisManager.getClient().ping();
      return true;
    } catch {
      return false;
    }
  }

  // ====================
  // Job Handlers
  // ====================

  private async handleSendEmail(data: JobDataMap['send-email'], job: Job): Promise<unknown> {
    logger.info('Sending email', { jobId: job.id, to: data.to });
    // Implement email sending logic
    return { sent: true, timestamp: new Date().toISOString() };
  }

  private async handleSendSMS(data: JobDataMap['send-sms'], job: Job): Promise<unknown> {
    logger.info('Sending SMS', { jobId: job.id, to: data.to });
    // Implement SMS sending logic
    return { sent: true, timestamp: new Date().toISOString() };
  }

  private async handleSendNotification(data: JobDataMap['send-notification'], job: Job): Promise<unknown> {
    logger.info('Sending notification', { jobId: job.id, userId: data.userId, notificationType: data.type });
    // Implement notification logic
    return { sent: true, timestamp: new Date().toISOString() };
  }

  private async handleAppointmentReminder(
    data: JobDataMap['process-appointment-reminder'],
    job: Job
  ): Promise<unknown> {
    logger.info('Processing appointment reminder', {
      jobId: job.id,
      appointmentId: data.appointmentId,
      reminderType: data.reminderType
    });
    // Implement appointment reminder logic
    return { processed: true, timestamp: new Date().toISOString() };
  }

  private async handleImmunizationReminder(
    data: JobDataMap['process-immunization-reminder'],
    job: Job
  ): Promise<unknown> {
    logger.info('Processing immunization reminder', {
      jobId: job.id,
      patientId: data.patientId,
      dueDate: data.dueDate
    });
    // Implement immunization reminder logic
    return { processed: true, timestamp: new Date().toISOString() };
  }

  private async handleFollowupReminder(data: JobDataMap['process-followup-reminder'], job: Job): Promise<unknown> {
    logger.info('Processing follow-up reminder', { jobId: job.id, patientId: data.patientId });
    return { processed: true, timestamp: new Date().toISOString() };
  }

  private async handleGenerateReport(data: JobDataMap['generate-report'], job: Job): Promise<unknown> {
    logger.info('Generating report', {
      jobId: job.id,
      reportId: data.reportId,
      reportType: data.type
    });
    // Implement report generation logic
    return { generated: true, timestamp: new Date().toISOString() };
  }

  private async handleGenerateGrowthChart(data: JobDataMap['generate-growth-chart'], job: Job): Promise<unknown> {
    logger.info('Generating growth chart', { jobId: job.id, patientId: data.patientId });
    // Implement growth chart generation
    return { generated: true, timestamp: new Date().toISOString() };
  }

  private async handleExportRecords(data: JobDataMap['export-records'], job: Job): Promise<unknown> {
    logger.info('Exporting records', {
      jobId: job.id,
      exportId: data.exportId,
      format: data.format
    });
    // Implement export logic
    return { exported: true, timestamp: new Date().toISOString() };
  }

  private async handleImportRecords(data: JobDataMap['import-records'], job: Job): Promise<unknown> {
    logger.info('Importing records', { jobId: job.id, importId: data.importId });
    // Implement import logic
    return { imported: true, timestamp: new Date().toISOString() };
  }

  private async handleBackupDatabase(data: JobDataMap['backup-database'], job: Job): Promise<unknown> {
    logger.info('Backing up database', { jobId: job.id, backupId: data.backupId });
    // Implement backup logic
    return { backedUp: true, timestamp: new Date().toISOString() };
  }

  private async handleCacheWarm(data: JobDataMap['cache-warm'], job: Job): Promise<unknown> {
    logger.info('Warming cache', { jobId: job.id, keys: data.keys });
    // Implement cache warming logic
    return { warmed: true, timestamp: new Date().toISOString() };
  }

  private async handleProcessVitals(data: JobDataMap['process-vitals'], job: Job): Promise<unknown> {
    logger.info('Processing vitals', {
      jobId: job.id,
      patientId: data.patientId,
      vitalsCount: data.vitals.length
    });
    // Implement vitals processing logic
    return { processed: true, timestamp: new Date().toISOString() };
  }

  private async handleGrowthCalculation(data: JobDataMap['calculate-growth-percentiles'], job: Job): Promise<unknown> {
    logger.info('Calculating growth percentiles', {
      jobId: job.id,
      patientId: data.patientId,
      measurementsCount: data.measurements.length
    });
    // Implement growth calculation logic
    return { calculated: true, timestamp: new Date().toISOString() };
  }

  private async handleSyncCalendar(data: JobDataMap['sync-calendar'], job: Job): Promise<unknown> {
    logger.info('Syncing calendar', {
      jobId: job.id,
      userId: data.userId,
      provider: data.provider
    });
    // Implement calendar sync logic
    return { synced: true, timestamp: new Date().toISOString() };
  }

  private async handleProcessBilling(data: JobDataMap['process-billing'], job: Job): Promise<unknown> {
    logger.info('Processing billing', { jobId: job.id, billingCycle: data.billingCycle });
    // Implement billing logic
    return { processed: true, timestamp: new Date().toISOString() };
  }
}

// Create singleton instance
export const queueManager = new JobQueueManager();

// Initialize queues only when needed (lazy initialization)
export async function initializeQueues(): Promise<void> {
  await queueManager.initialize();
}

// Export convenience functions with lazy initialization
export const addJob = async <T extends JobType>(type: T, data: JobDataMap[T], options?: JobOptions) => {
  await queueManager.initialize();
  return queueManager.addJob(type, data, options);
};

export const getJob = async <T extends JobType>(type: T, jobId: string) => {
  await queueManager.initialize();
  return queueManager.getJob(type, jobId);
};

export const getQueueStats = async (type: JobType) => {
  await queueManager.initialize();
  return queueManager.getQueueStats(type);
};

export const pauseQueue = async (type: JobType) => {
  await queueManager.initialize();
  return queueManager.pauseQueue(type);
};

export const resumeQueue = async (type: JobType) => {
  await queueManager.initialize();
  return queueManager.resumeQueue(type);
};

export const retryFailedJobs = async (type: JobType) => {
  await queueManager.initialize();
  return queueManager.retryFailedJobs(type);
};

export const isQueueHealthy = async () => {
  return queueManager.isHealthy();
};

export type { Job } from 'bullmq';

// Export types
export * from './types';
