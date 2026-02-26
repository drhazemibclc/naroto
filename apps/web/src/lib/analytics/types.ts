export interface AnalyticsEvent {
  name: string;
  path: string;
  properties?: Record<string, unknown>;
  sessionId: string;
  timestamp: string;
  userId?: string;
}

export interface PageView {
  path: string;
  referrer: string;
  sessionId: string;
  timestamp: string;
  userAgent?: string;
  userId?: string;
}

export interface AnalyticsConfig {
  batchSize?: number;
  debug?: boolean;
  endpoint?: string;
  flushInterval?: number;
  sampleRate?: number;
}
