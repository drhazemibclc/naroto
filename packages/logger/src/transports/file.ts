import fs from 'node:fs';
import path from 'node:path';

import { createStream, type RotatingFileStream } from 'rotating-file-stream';

import type { LogEntry, Transport } from '../types';

export interface FileTransportOptions {
  compress?: boolean;
  filename?: string;
  interval?: `${number}d` | `${number}h` | `${number}m` | `${number}s`;
  maxFiles?: number;
  maxSize?: `${number}B` | `${number}K` | `${number}M` | `${number}G`;
  path?: string;
}

interface ResolvedFileTransportOptions {
  compress: boolean;
  filename: string;
  interval: string;
  maxFiles: number;
  maxSize: `${number}B` | `${number}K` | `${number}M` | `${number}G`;
  path: string;
}

export class FileTransport implements Transport {
  name = 'file';
  private readonly stream: RotatingFileStream;
  private readonly options: ResolvedFileTransportOptions;

  constructor(options: FileTransportOptions = {}) {
    this.options = {
      path: options.path ?? './logs',
      filename: options.filename ?? 'app.log',
      maxSize: options.maxSize ?? '10M',
      maxFiles: options.maxFiles ?? 10,
      compress: options.compress ?? true,
      interval: options.interval ?? '1d'
    };

    if (!fs.existsSync(this.options.path)) {
      fs.mkdirSync(this.options.path, { recursive: true });
    }

    const logPath = path.join(this.options.path, this.options.filename);

    this.stream = createStream(logPath, {
      size: this.options.maxSize,
      interval: this.options.interval,
      compress: this.options.compress,
      maxFiles: this.options.maxFiles
    });
  }

  log(entry: LogEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const logLine = `${JSON.stringify({
          timestamp: entry.timestamp.toISOString(),
          level: entry.level,
          message: entry.message,
          ...entry.metadata,
          error: entry.error
        })}\n`;

        this.stream.write(logLine, (err?: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async flush(): Promise<void> {
    await new Promise<void>(resolve => this.stream.end(resolve));
  }

  async close(): Promise<void> {
    await this.flush();
  }
}

export default FileTransport;
