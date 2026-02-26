import type { AnalyticsConfig, AnalyticsEvent } from './types';

class AnalyticsService {
  private readonly sessionId: string;
  private events: AnalyticsEvent[] = [];
  private readonly config: Required<AnalyticsConfig>;
  private flushTimer: NodeJS.Timeout | null = null;
  private userId?: string;

  constructor(config: AnalyticsConfig = {}) {
    this.config = {
      endpoint: config.endpoint || '/api/analytics',
      sampleRate: config.sampleRate || 1,
      debug: config.debug || process.env.NODE_ENV === 'development',
      batchSize: config.batchSize || 10,
      flushInterval: config.flushInterval || 5000
    };

    this.sessionId = this.generateSessionId();
    this.setupFlushTimer();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  private setupFlushTimer(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval);
  }

  setUserId(id: string): void {
    this.userId = id;
  }

  trackEvent(name: string, properties?: Record<string, unknown>): void {
    // Apply sampling
    if (Math.random() > this.config.sampleRate) return;

    const event: AnalyticsEvent = {
      name,
      properties,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
      path: window.location.pathname
    };

    this.events.push(event);

    if (this.config.debug) {
      console.log('[Analytics]', event);
    }

    if (this.events.length >= this.config.batchSize) {
      this.flush();
    }
  }

  trackPageView(path: string, referrer: string): void {
    this.trackEvent('page_view', { path, referrer });
  }

  async flush(): Promise<void> {
    if (this.events.length === 0) return;

    const eventsToSend = [...this.events];
    this.events = [];

    if (this.config.debug) {
      console.log('[Analytics] Flushing', eventsToSend.length, 'events');
    }

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          events: eventsToSend,
          sessionId: this.sessionId,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok && this.config.debug) {
        console.error('[Analytics] Failed to send events');
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('[Analytics] Error sending events:', error);
      }
      // Re-queue events on failure
      this.events.unshift(...eventsToSend);
    }
  }

  // Clean up on page unload
  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }
}

// Singleton instance
export const analytics = new AnalyticsService({
  endpoint: '/api/analytics',
  debug: process.env.NODE_ENV === 'development',
  sampleRate: 1 // 100% sampling
});

// Initialize analytics on client side
if (typeof window !== 'undefined') {
  // Track initial page view
  analytics.trackPageView(window.location.pathname, document.referrer);
}
