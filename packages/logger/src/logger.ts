// logger.ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import { hostname } from 'node:os';

import dayjs from 'dayjs';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

import ConsoleTransport from './transports/console';
import FileTransport from './transports/file';
import type {
  AuditDetails,
  ErrorDetails,
  ILogger,
  LogContext,
  LogEntry,
  LoggerConfig,
  LogLevel,
  LogMetadata,
  Transport,
  TransportConfig
} from './types';

const DEFAULT_CONFIG: LoggerConfig = {
  level: (process.env.NODE_ENV === 'production' ? 'info' : 'debug') as LogLevel,
  environment: process.env.NODE_ENV || 'development',
  version: process.env.npm_package_version,
  service: 'pediacare',
  appName: 'PediaCare',
  redactFields: ['password', 'token', 'secret', 'ssn', 'insuranceNumber'],
  redactPaths: ['*.password', '*.token', '*.secret', '*.ssn'],
  prettyPrint: process.env.NODE_ENV !== 'production',
  timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS Z',
  bufferSize: 100,
  flushInterval: 5000,
  async: true,
  transports: [
    { type: 'console', level: ['info', 'error', 'warn', 'debug'], enabled: true },
    { type: 'file', level: ['error', 'fatal'], enabled: process.env.NODE_ENV === 'production' },
    { type: 'database', level: ['audit'], enabled: process.env.NODE_ENV === 'production' },
    { type: 'sentry', level: ['error', 'fatal'], enabled: !!process.env.SENTRY_DSN }
  ],
  sentryDsn: process.env.SENTRY_DSN,
  sampleRate: 0.1
};

export class Logger implements ILogger {
  private static instance: Logger;
  pino!: pino.Logger;
  private _context: LogContext = {};
  private readonly config: LoggerConfig;
  private readonly transports: Map<string, Transport> = new Map();
  private buffer: LogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  get context(): LogContext {
    return this._context;
  }

  set context(context: LogContext) {
    this._context = { ...this._context, ...context };
  }

  private constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializePino();
    this.initializeTransports();
    this.setupFlushInterval();

    // Handle process events
    this.setupProcessHandlers();
  }

  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  private initializePino(): void {
    const pinoConfig: pino.LoggerOptions = {
      level: this.config.level,
      base: {
        pid: process.pid,
        hostname: hostname(),
        service: this.config.service,
        version: this.config.version,
        environment: this.config.environment
      },
      timestamp: () => `,"timestamp":"${dayjs().format(this.config.timestampFormat)}"`,
      formatters: {
        level: label => ({ level: label }),
        bindings: bindings => ({
          pid: bindings.pid,
          host: bindings.hostname,
          service: bindings.service
        })
      },
      redact: {
        paths: this.config.redactPaths,
        censor: '[REDACTED]'
      },
      serializers: {
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res
      }
    };

    if (this.config.prettyPrint) {
      pinoConfig.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          singleLine: false
        }
      };
    }

    this.pino = pino(pinoConfig);
  }

  private initializeTransports(): void {
    // Only initialize built-in transports if no custom ones added yet
    if (this.transports.size === 0) {
      for (const transportConfig of this.config.transports || []) {
        this.createTransport(transportConfig)
          .then(transport => {
            if (transport) {
              this.transports.set(transportConfig.type, transport);
            }
          })
          .catch(err => {
            console.error(`Failed to initialize transport ${transportConfig.type}:`, err);
          });
      }
    }
  }

  private async createTransport(config: TransportConfig): Promise<Transport | null> {
    if (!config.enabled) return null;

    switch (config.type) {
      case 'console': {
        return this.wrapTransport(new ConsoleTransport());
      }

      case 'file': {
        return this.wrapTransport(new FileTransport(config.options));
      }

      case 'sentry':
        if (this.config.sentryDsn) {
          const { SentryTransport } = await import('./transports/sentry');
          return new SentryTransport({ dsn: this.config.sentryDsn, ...config.options });
        }
        return null;

      case 'database':
        // Database transport should be registered externally via addTransport
        return null;

      default:
        return null;
    }
  }

  private wrapTransport(transport: { log(entry: LogEntry): void; name: string }): Transport {
    return {
      name: transport.name,
      async log(entry: LogEntry): Promise<void> {
        transport.log(entry);
      }
    };
  }

  private setupFlushInterval(): void {
    if (this.config.async && this.config.flushInterval) {
      this.flushTimer = setInterval(() => {
        this.flush().catch(err => {
          console.error('Failed to flush logs:', err);
        });
      }, this.config.flushInterval);

      // Don't prevent process exit
      this.flushTimer.unref();
    }
  }

  private setupProcessHandlers(): void {
    // Flush on exit
    process.on('beforeExit', async () => {
      await this.flush();
    });

    // Handle uncaught errors
    process.on('uncaughtException', async error => {
      this.fatal('Uncaught exception', {}, error);
      await this.flush();
      process.exit(1);
    });

    process.on('unhandledRejection', async reason => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.error('Unhandled rejection', {}, error);
    });
  }

  private shouldLog(level: LogLevel, transport: TransportConfig): boolean {
    if (!transport.enabled) return false;
    if (!transport.level) return true;

    const levels = Array.isArray(transport.level) ? transport.level : [transport.level];
    return levels.includes(level);
  }

  private async processEntry(entry: LogEntry): Promise<void> {
    // Sample performance logs if configured
    if (entry.metadata?.type === 'PERFORMANCE' && this.config.sampleRate && Math.random() > this.config.sampleRate) {
      return;
    }

    const promises: Promise<void>[] = [];

    for (const [_, transport] of this.transports) {
      const config = this.config.transports.find(c => c.type === transport.name);
      if (config && this.shouldLog(entry.level, config)) {
        promises.push(
          Promise.resolve(transport.log(entry)).catch(err => {
            console.error(`Transport ${transport.name} error:`, err);
          })
        );
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  private createEntry(level: LogLevel, message: string, metadata?: LogMetadata, error?: Error): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      metadata: {
        ...metadata,
        ...this._context,
        requestId: metadata?.requestId || this._context?.requestId || uuidv4()
      }
    };

    if (error) {
      entry.error = this.formatError(error);
    }

    return entry;
  }

  private formatError(error: Error): ErrorDetails {
    const errorWithExtras = error as Error & {
      code?: string | number;
      statusCode?: number;
      isOperational?: boolean;
    };

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: errorWithExtras.code,
      statusCode: errorWithExtras.statusCode,
      cause: error.cause as Error,
      isOperational: errorWithExtras.isOperational
    };
  }

  async log(entry: LogEntry): Promise<void> {
    if (this.config.async) {
      this.buffer.push(entry);

      if (this.buffer.length >= this.config.bufferSize) {
        // Don't await, just trigger flush
        this.flush().catch(err => {
          console.error('Failed to flush log buffer:', err);
        });
      }
    } else {
      await this.processEntry(entry);
    }
  }

  async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) return;

    this.isFlushing = true;
    const entries = [...this.buffer];
    this.buffer = [];

    try {
      await Promise.all(entries.map(entry => this.processEntry(entry)));
    } finally {
      this.isFlushing = false;
    }
  }

  // Core logging methods
  fatal(message: string, metadata?: LogMetadata, error?: Error): void {
    const entry = this.createEntry('fatal', message, metadata, error);
    this.pino.fatal({ ...entry.metadata, error: entry.error }, entry.message);
    this.log(entry);
  }

  error(message: string, metadata?: LogMetadata, error?: Error): void {
    const entry = this.createEntry('error', message, metadata, error);
    this.pino.error({ ...entry.metadata, error: entry.error }, entry.message);
    this.log(entry);
  }

  warn(message: string, metadata?: LogMetadata): void {
    const entry = this.createEntry('warn', message, metadata);
    this.pino.warn(entry.metadata, entry.message);
    this.log(entry);
  }

  info(message: string, metadata?: LogMetadata): void {
    const entry = this.createEntry('info', message, metadata);
    this.pino.info(entry.metadata, entry.message);
    this.log(entry);
  }

  debug(message: string, metadata?: LogMetadata): void {
    if (this.config.level !== 'debug' && this.config.level !== 'trace') return;
    const entry = this.createEntry('debug', message, metadata);
    this.pino.debug(entry.metadata, entry.message);
    this.log(entry);
  }

  trace(message: string, metadata?: LogMetadata): void {
    if (this.config.level !== 'trace') return;
    const entry = this.createEntry('trace', message, metadata);
    this.pino.trace(entry.metadata, entry.message);
    this.log(entry);
  }

  // Pediatric-specific methods
  patientFlow(patientId: string, action: string, metadata?: LogMetadata): void {
    this.info(`Patient flow: ${action}`, {
      type: 'PATIENT_FLOW',
      patientId,
      action,
      ...metadata
    });
  }

  appointment(action: string, appointmentId: string, metadata?: LogMetadata): void {
    this.info(`Appointment: ${action}`, {
      type: 'APPOINTMENT',
      appointmentId,
      action,
      ...metadata
    });
  }

  clinical(level: LogLevel, message: string, patientId: string, metadata?: LogMetadata): void {
    const clinicalMetadata: LogMetadata = {
      ...metadata,
      type: 'ENCOUNTER',
      patientId
    };

    if (level === 'error') {
      this.error(`Clinical: ${message}`, clinicalMetadata);
    } else if (level === 'warn') {
      this.warn(`Clinical: ${message}`, clinicalMetadata);
    }
  }

  security(event: string, metadata?: LogMetadata): void {
    this.warn(`Security: ${event}`, {
      type: 'SECURITY',
      ...metadata
    });
  }

  audit(details: AuditDetails): void;
  audit(action: string, resource: string, resourceId: string, details: AuditDetails): void;
  audit(actionOrDetails: string | AuditDetails, resource?: string, resourceId?: string, details?: AuditDetails): void {
    let auditAction: string;
    let auditResource: string;
    let auditResourceId: string;
    let auditDetails: AuditDetails;

    if (typeof actionOrDetails === 'string') {
      auditAction = actionOrDetails;
      auditResource = resource || '';
      auditResourceId = resourceId || '';
      auditDetails = details ?? { userId: '', action: '', resource: '', resourceId: '' };
    } else {
      auditAction = actionOrDetails.action || '';
      auditResource = actionOrDetails.resource || '';
      auditResourceId = actionOrDetails.resourceId || '';
      auditDetails = actionOrDetails;
    }

    const entry = this.createEntry('info' as LogLevel, `Audit: ${auditAction} on ${auditResource}`, {
      type: 'AUDIT',
      audit: {
        ...auditDetails,
        action: auditAction,
        resource: auditResource,
        resourceId: auditResourceId
      }
    });

    // Log to pino with special formatting
    this.pino.info({ audit: true, ...entry.metadata }, entry.message);
    this.log(entry);
  }

  performance(operation: string, duration: number, metadata?: LogMetadata): void {
    const level = duration > 1000 ? 'warn' : 'debug';
    this[level](`Performance: ${operation} (${duration}ms)`, {
      type: 'PERFORMANCE',
      operation,
      duration,
      ...metadata
    });
  }

  // Context management
  getContext(): LogContext {
    return { ...this._context };
  }

  setContext(context: LogContext): void {
    this._context = { ...context };
  }

  child(metadata: LogMetadata): ILogger {
    const child = new Logger({ ...this.config });
    child.context = { ...this._context, ...metadata };

    // Copy transports
    for (const [name, transport] of this.transports) {
      child.transports.set(name, transport);
    }

    return child;
  }

  withRequest(
    req: IncomingMessage & {
      id?: string;
      requestId?: string;
      user?: { id?: string };
      clinic?: { id?: string };
      ip?: string;
      socket?: { remoteAddress?: string };
    },
    res: ServerResponse & { on?: (event: string, callback: () => void) => void }
  ): ILogger {
    const requestId = req.id || req.requestId || uuidv4();

    const context: LogContext = {
      requestId,
      userId: req.user?.id,
      path: req.url,
      method: req.method,
      ip: this.getClientIp(req),
      userAgent: this.getUserAgent(req),
      startTime: new Date()
    };

    const logger = this.child({ requestId });
    logger.context = { ...logger.context, ...context };

    // Log request start
    logger.info('Request started', {
      path: context.path,
      method: context.method
    });

    // Log on finish
    if (res.on) {
      res.on('finish', () => {
        const duration = Date.now() - (context.startTime?.getTime() || Date.now());
        logger.performance(`${context.method} ${context.path}`, duration, {
          statusCode: res.statusCode
        });
      });
    }

    return logger;
  }

  private getClientIp(req: IncomingMessage & { ip?: string; socket?: { remoteAddress?: string } }): string | undefined {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      return Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0]?.trim();
    }
    if (req.socket?.remoteAddress) {
      return req.socket.remoteAddress;
    }
    return req.ip || req.socket?.remoteAddress;
  }

  private getUserAgent(req: IncomingMessage): string | undefined {
    const ua = req.headers['user-agent'];
    return Array.isArray(ua) ? ua[0] : ua;
  }

  // Transport management
  addTransport(transport: Transport): void {
    this.transports.set(transport.name, transport);
  }

  async removeTransport(name: string): Promise<void> {
    const transport = this.transports.get(name);
    if (transport?.close) {
      await transport.close();
    }
    this.transports.delete(name);
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();

    for (const transport of this.transports.values()) {
      if (transport.close) {
        await transport.close().catch(err => {
          console.error(`Failed to close transport ${transport.name}:`, err);
        });
      }
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Pre-configured module loggers
export function createModuleLogger(module: string): ILogger {
  const child = logger.child({ module });
  child.context = { ...child.context, module };
  return child;
}

// Module-specific loggers
export const serverLogger = createModuleLogger('server');
export const dbLogger = createModuleLogger('database');
export const authLogger = createModuleLogger('auth');
export const redisLogger = createModuleLogger('redis');
export const queueLogger = createModuleLogger('queue');
export const patientLogger = createModuleLogger('patient');
export const appointmentLogger = createModuleLogger('appointment');

export default logger;
