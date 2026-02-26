import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import type { AnalyticsEvent } from '@/lib/analytics/types';

interface StoredEvent extends AnalyticsEvent {
  ip: string | string[];
  receivedAt: string;
  userAgent: string | null;
}

interface StoredSession {
  events: AnalyticsEvent[];
  firstSeen: string;
  id: string;
  lastSeen: string;
  userAgent: string | null;
}

// In-memory storage (replace with database in production)
const eventsStore: StoredEvent[] = [];
const sessionsStore = new Map<string, StoredSession>();

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const userAgent = headersList.get('user-agent');
    const ip = headersList.get('x-forwarded-for') || 'unknown';

    const body = await request.json();
    const { events, sessionId, timestamp } = body;

    // Store events
    eventsStore.push(
      ...events.map((event: AnalyticsEvent) => ({
        ...event,
        userAgent,
        ip: process.env.NODE_ENV === 'production' ? ip : '[REDACTED]',
        receivedAt: new Date().toISOString()
      }))
    );

    // Update session
    if (!sessionsStore.has(sessionId)) {
      sessionsStore.set(sessionId, {
        id: sessionId,
        firstSeen: timestamp,
        lastSeen: timestamp,
        events: [],
        userAgent
      });
    }

    const session = sessionsStore.get(sessionId);
    if (session) {
      session.lastSeen = timestamp;
      session.events.push(...events);
    }

    // Limit storage (keep last 1000 events)
    if (eventsStore.length > 1000) {
      eventsStore.splice(0, eventsStore.length - 1000);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to process analytics' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Analytics API is only available in development' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type');

  if (type === 'stats') {
    return NextResponse.json({
      totalEvents: eventsStore.length,
      totalSessions: sessionsStore.size,
      activeSessions: Array.from(sessionsStore.values()).filter(
        s => Date.now() - new Date(s.lastSeen).getTime() < 30 * 60 * 1000
      ).length,
      recentEvents: eventsStore.slice(-10)
    });
  }

  if (type === 'events') {
    const limit = Number.parseInt(searchParams.get('limit') || '50', 10);
    return NextResponse.json(eventsStore.slice(-limit));
  }

  if (type === 'sessions') {
    return NextResponse.json(Array.from(sessionsStore.entries()));
  }

  return NextResponse.json({
    events: eventsStore,
    sessions: Array.from(sessionsStore.entries())
  });
}

// Clean up old sessions periodically
setInterval(
  () => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    for (const [sessionId, session] of sessionsStore.entries()) {
      if (new Date(session.lastSeen).getTime() < oneDayAgo) {
        sessionsStore.delete(sessionId);
      }
    }
  },
  60 * 60 * 1000
); // Run every hour
