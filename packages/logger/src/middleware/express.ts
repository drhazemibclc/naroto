import type { NextFunction, Request, Response } from 'express';
import onHeaders from 'on-headers';
import { v4 as uuidv4 } from 'uuid';

import { logger } from '../logger';

export interface ExpressLoggerOptions {
  excludePaths?: string[];
  headerName?: string;
  level?: string;
  logBody?: boolean;
  logHeaders?: boolean;
  logRequest?: boolean;
  logResponse?: boolean;
}

export function expressLogger(options: ExpressLoggerOptions = {}) {
  const {
    headerName = 'X-Request-ID',
    logRequest = true,
    logResponse = true,
    logBody = false,
    logHeaders = false,
    excludePaths = ['/health', '/metrics', '/favicon.ico']
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip excluded paths
    if (excludePaths.includes(req.path)) {
      return next();
    }

    // Add request ID
    const headerValue = req.headers[headerName.toLowerCase()];
    const requestId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const finalRequestId: string = requestId || uuidv4();
    if (typeof finalRequestId === 'string') {
      req.headers[headerName.toLowerCase()] = finalRequestId;
      res.setHeader(headerName, finalRequestId);
    }

    // Create request logger
    const requestLogger = logger.child({
      requestId: finalRequestId,
      path: req.path,
      method: req.method,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Attach to request
    const enhancedReq = req as Request & {
      logger: typeof requestLogger;
      requestId: string;
    };
    enhancedReq.logger = requestLogger;
    enhancedReq.requestId = finalRequestId;

    // Log request
    if (logRequest) {
      const requestLog: Record<string, unknown> = {
        method: req.method,
        url: req.url,
        query: req.query,
        params: req.params
      };

      if (logBody) {
        requestLog.body = req.body;
      }

      if (logHeaders) {
        requestLog.headers = req.headers;
      }

      requestLogger.info('Request started', requestLog);
    }

    // Track response time
    const startTime = Date.now();

    onHeaders(res, () => {
      const duration = Date.now() - startTime;

      // Log response
      if (logResponse) {
        const responseLog: Record<string, unknown> = {
          statusCode: res.statusCode,
          duration
        };

        requestLogger.info('Request completed', responseLog);

        // Log slow requests
        if (duration > 1000) {
          requestLogger.warn('Slow request detected', {
            duration,
            path: req.path,
            method: req.method
          });
        }
      }
    });

    next();
  };
}
