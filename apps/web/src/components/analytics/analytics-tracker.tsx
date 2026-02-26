'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { analytics } from '@/lib/analytics/service';

// Performance metrics tracking
function trackPerformance() {
  if (typeof window === 'undefined' || !('performance' in window)) return;

  // Track Web Vitals
  if ('web-vital' in window) {
    // Core Web Vitals are automatically tracked by Next.js
  }

  // Track page load metrics
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (navigation) {
    analytics.trackEvent('performance', {
      dns: navigation.domainLookupEnd - navigation.domainLookupStart,
      tcp: navigation.connectEnd - navigation.connectStart,
      ttfb: navigation.responseStart - navigation.requestStart,
      domLoad: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      windowLoad: navigation.loadEventEnd - navigation.loadEventStart,
      total: navigation.loadEventEnd - navigation.startTime
    });
  }
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPathRef = useRef(pathname);

  useEffect(() => {
    // Track page views on route change
    if (pathname !== lastPathRef.current) {
      analytics.trackPageView(
        pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : ''),
        lastPathRef.current
      );
      lastPathRef.current = pathname;
    }

    // Track performance on initial load
    trackPerformance();

    // Clean up on unmount
    return () => {
      analytics.destroy();
    };
  }, [pathname, searchParams]);

  // Track user interactions
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('button');
      const link = target.closest('a');

      if (button?.getAttribute('data-analytics')) {
        analytics.trackEvent('button_click', {
          buttonId: button.id,
          buttonText: button.textContent
        });
      }

      if (link?.getAttribute('data-analytics')) {
        analytics.trackEvent('link_click', {
          href: link.getAttribute('href'),
          text: link.textContent
        });
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}
