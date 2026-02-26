import type * as SentryNode from '@sentry/node';

import type { LogEntry, Transport } from '../types';

interface SentryTransportOptions {
  dsn?: string;
  environment?: string;
  tracesSampleRate?: number;
}

export class SentryTransport implements Transport {
  name = 'sentry';
  private Sentry: typeof SentryNode | null = null;
  private readonly options: Required<SentryTransportOptions>;
  private initialized = false;

  constructor(options: SentryTransportOptions = {}) {
    this.options = {
      dsn: options.dsn ?? process.env.SENTRY_DSN ?? '',
      environment: options.environment ?? process.env.NODE_ENV ?? 'development',
      tracesSampleRate: options.tracesSampleRate ?? 0.1
    };

    void this.initializeSentry();
  }

  private async initializeSentry(): Promise<void> {
    if (!this.options.dsn || this.initialized) return;

    try {
      const Sentry: typeof import('@sentry/node') = await import('@sentry/node');

      // Import integrations directly in Sentry v10+
      const { httpIntegration } = await import('@sentry/node');
      const { expressIntegration } = await import('@sentry/node');

      Sentry.init({
        dsn: this.options.dsn,
        environment: this.options.environment,
        tracesSampleRate: this.options.tracesSampleRate,
        integrations: [httpIntegration(), expressIntegration()]
      });

      this.Sentry = Sentry;
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Sentry:', error);
      this.Sentry = null;
    }
  }

  async log(entry: LogEntry): Promise<void> {
    if (!(this.initialized && this.Sentry)) return;

    // Only log errors and fatals
    if (!['error', 'fatal'].includes(entry.level)) return;

    const scope = new this.Sentry.Scope();

    if (entry.metadata) {
      scope.setContext('metadata', entry.metadata);
      if (entry.metadata.userId) scope.setUser({ id: entry.metadata.userId });
      if (entry.metadata.clinicId) scope.setTag('clinicId', entry.metadata.clinicId);
      if (entry.metadata.patientId) scope.setTag('patientId', entry.metadata.patientId);
      if (entry.metadata.type) scope.setTag('logType', entry.metadata.type);
    }

    scope.setLevel(entry.level === 'fatal' ? 'fatal' : 'error');

    if (entry.error) {
      const error = new Error(entry.error.message);
      error.name = entry.error.name;
      error.stack = entry.error.stack;
      this.Sentry.captureException(error, scope);
    } else {
      this.Sentry.captureMessage(entry.message, scope);
    }
  }

  async flush(): Promise<void> {
    if (this.initialized && this.Sentry) {
      await this.Sentry.flush();
    }
  }

  async close(): Promise<void> {
    await this.flush();
  }
}
