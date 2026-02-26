import stackTrace from 'stack-trace';

import type { ErrorDetails } from './types';

type ExtendedError = Error & {
  code?: string | number;
  statusCode?: number;
  isOperational?: boolean;
  cause?: unknown;
};

export function formatError(error: Error): ErrorDetails {
  const extended = error as ExtendedError;

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: extended.code,
    statusCode: extended.statusCode,
    cause: extended.cause instanceof Error ? extended.cause : undefined,
    isOperational: extended.isOperational
  };
}

export function formatStack(error: Error): string {
  const trace = stackTrace.parse(error);

  return trace
    .map(frame => {
      const file = frame.getFileName() ?? '<unknown>';
      const line = frame.getLineNumber() ?? 0;
      const functionName = frame.getFunctionName() ?? '<anonymous>';
      return `  at ${functionName} (${file}:${line})`;
    })
    .join('\n');
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }

  return `${seconds}s`;
}

export function formatMemory(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'] as const;

  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
