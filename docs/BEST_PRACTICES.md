# 🏆 Best Practices & Recommendations - Smart Clinic

## 🎯 Top 10 Critical Recommendations

### 1. **Implement the "Cache-First" Pattern**

**Why**: 80% of your reads should hit cache, not database.

```typescript
// ✅ BEST: Cache layer wraps query layer
// modules/patient/patient.cache.ts
'use cache';

import { cacheTag, cacheLife } from 'next/cache';
import { CACHE_TAGS } from '@/lib/cache/tags';
import { CACHE_PROFILES } from '@/lib/cache/profiles';
import { patientQueries } from './patient.query';

export async function getCachedPatientById(id: string) {
  'use cache';
  
  cacheTag(CACHE_TAGS.patient.byId(id));
  cacheTag(CACHE_TAGS.patient.all);
  cacheLife(CACHE_PROFILES.short);
  
  return patientQueries.findById(id);
}

// modules/patient/patient.query.ts
import { db } from '@/server/db';

export const patientQueries = {
  findById(id: string) {
    return db.patient.findUnique({
      where: { id },
      include: {
        appointments: {
          take: 5,
          orderBy: { appointmentDate: 'desc' }
        }
      }
    });
  }
};
```

**Impact**: 10x faster response times, reduced database load.

---

### 2. **Use Hierarchical Cache Tags**

**Why**: Invalidate related data efficiently.

```typescript
// lib/cache/tags.ts
export const CACHE_TAGS = {
  // Hierarchical structure
  patient: {
    all: 'patients:all',                                    // Invalidates ALL patients
    byId: (id: string) => `patient:${id}`,                 // Specific patient
    byClinic: (clinicId: string) => `patients:clinic:${clinicId}`, // Clinic's patients
    
    // Nested resources
    appointments: (patientId: string) => `patient:${patientId}:appointments`,
    records: (patientId: string) => `patient:${patientId}:records`,
    billing: (patientId: string) => `patient:${patientId}:billing`
  },
  
  appointment: {
    all: 'appointments:all',
    byId: (id: string) => `appointment:${id}`,
    byClinic: (clinicId: string) => `appointments:clinic:${clinicId}`,
    byPatient: (patientId: string) => `appointments:patient:${patientId}`,
    byDoctor: (doctorId: string) => `appointments:doctor:${doctorId}`,
    byDate: (date: string) => `appointments:date:${date}`,
    
    // Time-based tags
    today: (clinicId: string) => `appointments:today:${clinicId}`,
    upcoming: (clinicId: string) => `appointments:upcoming:${clinicId}`
  }
} as const;

// Usage in action
export async function createAppointmentAction(input: CreateAppointmentInput) {
  const appointment = await db.appointment.create({ data: input });
  
  // Invalidate all related caches
  revalidateTag(CACHE_TAGS.appointment.byPatient(input.patientId));
  revalidateTag(CACHE_TAGS.appointment.byDoctor(input.doctorId));
  revalidateTag(CACHE_TAGS.appointment.byDate(input.date));
  revalidateTag(CACHE_TAGS.appointment.today(input.clinicId));
  revalidateTag(CACHE_TAGS.patient.appointments(input.patientId));
  
  return appointment;
}
```

**Impact**: Precise cache invalidation, no stale data.

---

### 3. **Implement Smart Cache Profiles**

**Why**: Different data has different freshness requirements.

```typescript
// lib/cache/profiles.ts
export const CACHE_PROFILES = {
  // Real-time: Appointments, vital signs, active sessions
  realtime: {
    stale: 10,        // 10 seconds
    revalidate: 30,   // Revalidate after 30s
    expire: 300       // Hard expire after 5 min
  },
  
  // Short: Patient lists, schedules, recent activity
  short: {
    stale: 300,       // 5 minutes
    revalidate: 600,  // Revalidate after 10 min
    expire: 1800      // Hard expire after 30 min
  },
  
  // Medium: Doctor profiles, clinic settings
  medium: {
    stale: 3600,      // 1 hour
    revalidate: 7200, // Revalidate after 2 hours
    expire: 86400     // Hard expire after 24 hours
  },
  
  // Long: Drug database, WHO standards
  long: {
    stale: 86400,      // 24 hours
    revalidate: 172800, // Revalidate after 2 days
    expire: 604800     // Hard expire after 7 days
  },
  
  // Max: Static reference data
  max: {
    stale: 604800,      // 7 days
    revalidate: 1209600, // Revalidate after 14 days
    expire: 2592000     // Hard expire after 30 days
  }
} as const;

// Usage guide
export const CACHE_STRATEGY = {
  // Medical data (prefer fresh)
  patients: 'short',
  appointments: 'realtime',
  medicalRecords: 'short',
  prescriptions: 'short',
  vitalSigns: 'realtime',
  
  // Administrative data
  doctors: 'medium',
  staff: 'medium',
  clinicSettings: 'medium',
  
  // Reference data
  drugs: 'long',
  whoStandards: 'max',
  icd10Codes: 'max',
  
  // Financial data (prefer fresh)
  billing: 'short',
  payments: 'short',
  invoices: 'short'
} as const;
```

**Impact**: Optimal balance between performance and data freshness.

---

### 4. **Use Parallel Prefetching**

**Why**: Load multiple queries simultaneously, not sequentially.

```typescript
// ❌ BAD: Sequential loading (slow)
export default async function DashboardPage() {
  const stats = await trpc.dashboard.stats.query();
  const appointments = await trpc.appointment.today.query();
  const patients = await trpc.patient.recent.query();
  
  return <Dashboard stats={stats} appointments={appointments} patients={patients} />;
}

// ✅ BEST: Parallel prefetching (fast)
export default async function DashboardPage() {
  const session = await getSession();
  const clinicId = session?.user?.clinic?.id;
  
  // Prefetch all queries in parallel
  await Promise.all([
    prefetch(trpc.dashboard.stats.queryOptions({ clinicId })),
    prefetch(trpc.appointment.today.queryOptions({ clinicId })),
    prefetch(trpc.patient.recent.queryOptions({ clinicId }))
  ]);
  
  return (
    <HydrateClient>
      <DashboardClient />
    </HydrateClient>
  );
}

// Client component uses prefetched data
'use client';

export function DashboardClient() {
  const trpc = useTRPC();
  
  // These queries hit cache immediately (no loading state)
  const { data: stats } = useQuery(trpc.dashboard.stats.queryOptions());
  const { data: appointments } = useQuery(trpc.appointment.today.queryOptions());
  const { data: patients } = useQuery(trpc.patient.recent.queryOptions());
  
  return (
    <div className="grid grid-cols-3 gap-4">
      <StatsCard stats={stats} />
      <AppointmentsList appointments={appointments} />
      <PatientsList patients={patients} />
    </div>
  );
}
```

**Impact**: 3x faster page loads.

---

### 5. **Strategic Suspense Boundaries**

**Why**: Stream slow content, show fast content immediately.

```typescript
// ✅ BEST: Granular Suspense boundaries
export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Fast query - no Suspense needed
  void prefetch(trpc.patient.getById.queryOptions({ id }));
  
  return (
    <HydrateClient>
      <div className="patient-detail">
        {/* Fast: Patient header (cached) */}
        <PatientHeader patientId={id} />
        
        <div className="grid grid-cols-2 gap-4">
          {/* Fast: Basic info (cached) */}
          <PatientInfo patientId={id} />
          
          {/* Slow: Complex medical history */}
          <Suspense fallback={<MedicalHistorySkeleton />}>
            <MedicalHistoryTimeline patientId={id} />
          </Suspense>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          {/* Slow: Growth charts with calculations */}
          <Suspense fallback={<GrowthChartSkeleton />}>
            <GrowthChart patientId={id} />
          </Suspense>
          
          {/* Slow: Appointment history */}
          <Suspense fallback={<AppointmentsSkeleton />}>
            <AppointmentHistory patientId={id} />
          </Suspense>
          
          {/* Slow: Billing summary */}
          <Suspense fallback={<BillingSkeleton />}>
            <BillingSummary patientId={id} />
          </Suspense>
        </div>
      </div>
    </HydrateClient>
  );
}
```

**Impact**: Perceived performance 2x better, users see content faster.

---

### 6. **Implement Optimistic Updates**

**Why**: Instant UI feedback, better UX.

```typescript
// ✅ BEST: Optimistic updates with rollback
'use client';

export function PatientForm({ patient }: { patient: Patient }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  
  const updatePatient = useMutation(
    trpc.patient.update.mutationOptions({
      onMutate: async (newData) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries(
          trpc.patient.getById.queryFilter({ id: patient.id })
        );
        
        // Snapshot previous value
        const previousPatient = queryClient.getQueryData(
          trpc.patient.getById.queryKey({ id: patient.id })
        );
        
        // Optimistically update
        queryClient.setQueryData(
          trpc.patient.getById.queryKey({ id: patient.id }),
          { ...patient, ...newData }
        );
        
        return { previousPatient };
      },
      
      onError: (err, newData, context) => {
        // Rollback on error
        if (context?.previousPatient) {
          queryClient.setQueryData(
            trpc.patient.getById.queryKey({ id: patient.id }),
            context.previousPatient
          );
        }
        toast.error('Failed to update patient');
      },
      
      onSuccess: () => {
        toast.success('Patient updated successfully');
      },
      
      onSettled: () => {
        // Refetch to ensure consistency
        queryClient.invalidateQueries(
          trpc.patient.getById.queryFilter({ id: patient.id })
        );
      }
    })
  );
  
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      updatePatient.mutate(formData);
    }}>
      {/* Form fields */}
    </form>
  );
}
```

**Impact**: Instant UI updates, better perceived performance.

---

### 7. **Use Type-Safe Cache Helpers**

**Why**: Prevent cache invalidation bugs.

```typescript
// lib/cache/helpers.ts
import { revalidateTag, updateTag } from 'next/cache';
import { CACHE_TAGS } from './tags';

// Type-safe cache invalidation
export const cacheHelpers = {
  patient: {
    invalidate(id: string) {
      revalidateTag(CACHE_TAGS.patient.byId(id));
      revalidateTag(CACHE_TAGS.patient.all);
    },
    
    invalidateClinic(clinicId: string) {
      revalidateTag(CACHE_TAGS.patient.byClinic(clinicId));
      revalidateTag(CACHE_TAGS.patient.all);
    },
    
    invalidateAll() {
      revalidateTag(CACHE_TAGS.patient.all);
    }
  },
  
  appointment: {
    invalidate(id: string, appointment: { patientId: string; doctorId: string; date: string }) {
      revalidateTag(CACHE_TAGS.appointment.byId(id));
      revalidateTag(CACHE_TAGS.appointment.byPatient(appointment.patientId));
      revalidateTag(CACHE_TAGS.appointment.byDoctor(appointment.doctorId));
      revalidateTag(CACHE_TAGS.appointment.byDate(appointment.date));
      revalidateTag(CACHE_TAGS.patient.appointments(appointment.patientId));
    },
    
    invalidateToday(clinicId: string) {
      revalidateTag(CACHE_TAGS.appointment.today(clinicId));
    }
  }
} as const;

// Usage in actions
export async function updateAppointmentAction(id: string, input: UpdateAppointmentInput) {
  const appointment = await db.appointment.update({
    where: { id },
    data: input
  });
  
  // Type-safe, comprehensive invalidation
  cacheHelpers.appointment.invalidate(id, {
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    date: appointment.appointmentDate.toISOString()
  });
  
  return appointment;
}
```

**Impact**: Zero cache invalidation bugs, easier maintenance.

---

### 8. **Implement Request Deduplication**

**Why**: Prevent duplicate queries in the same request.

```typescript
// lib/cache/dedupe.ts
import { cache } from 'react';

// Deduplicate queries within a single request
export const dedupeQuery = <T extends (...args: any[]) => Promise<any>>(fn: T): T => {
  return cache(fn) as T;
};

// Usage in query layer
export const patientQueries = {
  // Deduplicated - called multiple times in same request = 1 DB query
  findById: dedupeQuery((id: string) => {
    return db.patient.findUnique({
      where: { id },
      include: { appointments: true }
    });
  }),
  
  findByClinic: dedupeQuery((clinicId: string) => {
    return db.patient.findMany({
      where: { clinicId },
      orderBy: { createdAt: 'desc' }
    });
  })
};

// Example: Multiple components request same patient
// Only 1 database query is executed
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  return (
    <div>
      <PatientHeader patientId={id} />  {/* Calls patientQueries.findById(id) */}
      <PatientInfo patientId={id} />    {/* Calls patientQueries.findById(id) */}
      <PatientStats patientId={id} />   {/* Calls patientQueries.findById(id) */}
      {/* Only 1 DB query executed! */}
    </div>
  );
}
```

**Impact**: Reduce database queries by 50-70%.

---

### 9. **Use Conditional Caching**

**Why**: Cache public data aggressively, private data carefully.

```typescript
// modules/patient/patient.cache.ts
'use cache';

import { cacheTag, cacheLife } from 'next/cache';

// Public data - cache aggressively
export async function getCachedWHOStandards(gender: 'MALE' | 'FEMALE') {
  'use cache: remote'; // CDN-cacheable
  
  cacheTag(CACHE_TAGS.growth.byGender(gender));
  cacheLife(CACHE_PROFILES.max); // 7 days
  
  return whoStandardsQueries.findByGender(gender);
}

// Private data - cache per user
export async function getCachedPatientData(patientId: string, userId: string) {
  'use cache: private'; // User-specific cache
  
  cacheTag(CACHE_TAGS.patient.byId(patientId));
  cacheTag(`user:${userId}:patient:${patientId}`);
  cacheLife(CACHE_PROFILES.short);
  
  return patientQueries.findById(patientId);
}

// Shared clinic data - cache per clinic
export async function getCachedClinicPatients(clinicId: string) {
  'use cache';
  
  cacheTag(CACHE_TAGS.patient.byClinic(clinicId));
  cacheLife(CACHE_PROFILES.short);
  
  return patientQueries.findByClinic(clinicId);
}
```

**Impact**: Better cache hit rates, proper data isolation.

---

### 10. **Implement Cache Warming**

**Why**: Pre-populate cache for common queries.

```typescript
// lib/cache/warming.ts
import { getCachedWHOStandards } from '@/modules/growth/growth.cache';
import { getCachedDrugDatabase } from '@/modules/prescription/prescription.cache';

export async function warmCache() {
  console.log('🔥 Warming cache...');
  
  // Warm static reference data
  await Promise.all([
    // WHO growth standards
    getCachedWHOStandards('MALE'),
    getCachedWHOStandards('FEMALE'),
    
    // Drug database
    getCachedDrugDatabase(),
    
    // Common ICD-10 codes
    getCachedICD10Codes()
  ]);
  
  console.log('✅ Cache warmed');
}

// Call on server startup
// app/api/cron/warm-cache/route.ts
export async function GET() {
  await warmCache();
  return Response.json({ success: true });
}

// Or use Next.js instrumentation
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await warmCache();
  }
}
```

**Impact**: First request is as fast as subsequent requests.



---

## 🎨 Advanced Patterns

### Pattern 1: Incremental Static Regeneration (ISR) for Reports

```typescript
// app/(protected)/reports/[id]/page.tsx
export const dynamic = 'force-static';
export const revalidate = 3600; // Revalidate every hour

export async function generateStaticParams() {
  // Generate common report IDs
  return [
    { id: 'monthly-summary' },
    { id: 'patient-demographics' },
    { id: 'appointment-analytics' }
  ];
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // This page is statically generated and revalidated hourly
  const report = await getCachedReport(id);
  
  return <ReportViewer report={report} />;
}
```

### Pattern 2: Streaming with Progressive Enhancement

```typescript
// app/(protected)/dashboard/page.tsx
export default async function DashboardPage() {
  return (
    <div className="dashboard">
      {/* Static shell - renders immediately */}
      <DashboardHeader />
      
      {/* Critical data - prefetched */}
      <Suspense fallback={<StatsSkeleton />}>
        <CriticalStats />
      </Suspense>
      
      {/* Secondary data - streams */}
      <div className="grid grid-cols-2 gap-4">
        <Suspense fallback={<ChartSkeleton />}>
          <AppointmentChart />
        </Suspense>
        
        <Suspense fallback={<ListSkeleton />}>
          <RecentActivity />
        </Suspense>
      </div>
      
      {/* Tertiary data - lazy loaded */}
      <Suspense fallback={null}>
        <AnalyticsWidget />
      </Suspense>
    </div>
  );
}
```

### Pattern 3: Partial Prerendering (PPR)

```typescript
// next.config.ts
export default {
  experimental: {
    ppr: true, // Enable Partial Prerendering
  }
}

// app/(protected)/patient/[id]/page.tsx
export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  return (
    <div>
      {/* Static parts - prerendered */}
      <PatientHeader patientId={id} />
      <PatientNavigation />
      
      {/* Dynamic parts - rendered on demand */}
      <Suspense fallback={<Skeleton />}>
        <RealtimeVitalSigns patientId={id} />
      </Suspense>
      
      {/* Static again */}
      <PatientHistory patientId={id} />
    </div>
  );
}
```

### Pattern 4: Multi-Tenant Caching

```typescript
// lib/cache/multi-tenant.ts
export function createTenantCache<T>(
  queryFn: (clinicId: string, ...args: any[]) => Promise<T>,
  options: {
    tagPrefix: string;
    profile: keyof typeof CACHE_PROFILES;
  }
) {
  return async function cachedQuery(clinicId: string, ...args: any[]): Promise<T> {
    'use cache';
    
    // Tenant-specific cache tag
    cacheTag(`${options.tagPrefix}:clinic:${clinicId}`);
    cacheTag(`clinic:${clinicId}:data`);
    
    cacheLife(CACHE_PROFILES[options.profile]);
    
    return queryFn(clinicId, ...args);
  };
}

// Usage
export const getCachedClinicPatients = createTenantCache(
  patientQueries.findByClinic,
  {
    tagPrefix: 'patients',
    profile: 'short'
  }
);

// Invalidate all data for a clinic
export function invalidateClinicCache(clinicId: string) {
  revalidateTag(`clinic:${clinicId}:data`);
}
```

### Pattern 5: Stale-While-Revalidate with Fallback

```typescript
// modules/patient/patient.cache.ts
export async function getCachedPatientWithFallback(id: string) {
  'use cache';
  
  cacheTag(CACHE_TAGS.patient.byId(id));
  cacheLife(CACHE_PROFILES.short);
  
  try {
    return await patientQueries.findById(id);
  } catch (error) {
    // Return cached data even if stale
    console.error('Failed to fetch patient, using stale cache', error);
    
    // This will return stale cache if available
    return patientQueries.findById(id);
  }
}
```

---

## 🔒 Security Best Practices

### 1. Row-Level Security in Queries

```typescript
// modules/patient/patient.query.ts
export const patientQueries = {
  // Always filter by clinic for multi-tenancy
  findByClinic(clinicId: string, userId: string) {
    return db.patient.findMany({
      where: {
        clinicId,
        // Ensure user has access to this clinic
        clinic: {
          members: {
            some: {
              userId
            }
          }
        }
      }
    });
  },
  
  // Verify ownership before returning
  async findByIdSecure(id: string, userId: string) {
    const patient = await db.patient.findFirst({
      where: {
        id,
        clinic: {
          members: {
            some: {
              userId
            }
          }
        }
      }
    });
    
    if (!patient) {
      throw new Error('Patient not found or access denied');
    }
    
    return patient;
  }
};
```

### 2. Cache Isolation by User Role

```typescript
// lib/cache/role-based.ts
export function createRoleBasedCache<T>(
  queryFn: (...args: any[]) => Promise<T>,
  options: {
    allowedRoles: string[];
    tagPrefix: string;
  }
) {
  return async function cachedQuery(
    userId: string,
    userRole: string,
    ...args: any[]
  ): Promise<T> {
    'use cache';
    
    // Verify role
    if (!options.allowedRoles.includes(userRole)) {
      throw new Error('Unauthorized');
    }
    
    // Role-specific cache
    cacheTag(`${options.tagPrefix}:role:${userRole}`);
    cacheTag(`${options.tagPrefix}:user:${userId}`);
    
    return queryFn(...args);
  };
}
```

### 3. Sanitize Cache Keys

```typescript
// lib/cache/sanitize.ts
export function sanitizeCacheKey(key: string): string {
  // Remove sensitive data from cache keys
  return key
    .replace(/password|token|secret/gi, '[REDACTED]')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

export function createSafeCacheTag(prefix: string, ...parts: string[]): string {
  const sanitized = parts.map(sanitizeCacheKey).join(':');
  return `${prefix}:${sanitized}`;
}
```

---

## 📊 Monitoring & Debugging

### 1. Cache Hit Rate Tracking

```typescript
// lib/cache/monitoring.ts
const cacheStats = new Map<string, { hits: number; misses: number }>();

export function trackCacheAccess(tag: string, hit: boolean) {
  const stats = cacheStats.get(tag) || { hits: 0, misses: 0 };
  
  if (hit) {
    stats.hits++;
  } else {
    stats.misses++;
  }
  
  cacheStats.set(tag, stats);
}

export function getCacheStats() {
  const stats = Array.from(cacheStats.entries()).map(([tag, data]) => ({
    tag,
    hits: data.hits,
    misses: data.misses,
    hitRate: data.hits / (data.hits + data.misses)
  }));
  
  return stats.sort((a, b) => b.hitRate - a.hitRate);
}

// API endpoint to view stats
// app/api/cache-stats/route.ts
export async function GET() {
  const stats = getCacheStats();
  return Response.json(stats);
}
```

### 2. Cache Debugging Middleware

```typescript
// lib/cache/debug.ts
export function withCacheDebug<T>(
  fn: (...args: any[]) => Promise<T>,
  name: string
) {
  return async function debuggedCache(...args: any[]): Promise<T> {
    const start = Date.now();
    
    console.log(`[Cache] ${name} - Start`, { args });
    
    try {
      const result = await fn(...args);
      const duration = Date.now() - start;
      
      console.log(`[Cache] ${name} - Hit (${duration}ms)`);
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      console.error(`[Cache] ${name} - Miss (${duration}ms)`, error);
      
      throw error;
    }
  };
}

// Usage
export const getCachedPatients = withCacheDebug(
  async (clinicId: string) => {
    'use cache';
    cacheTag(CACHE_TAGS.patient.byClinic(clinicId));
    return patientQueries.findByClinic(clinicId);
  },
  'getCachedPatients'
);
```

### 3. Cache Invalidation Logging

```typescript
// lib/cache/logging.ts
export function logCacheInvalidation(tags: string[], reason: string) {
  console.log('[Cache Invalidation]', {
    tags,
    reason,
    timestamp: new Date().toISOString()
  });
  
  // Send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // analytics.track('cache_invalidation', { tags, reason });
  }
}

// Usage in actions
export async function updatePatientAction(id: string, input: any) {
  const patient = await db.patient.update({ where: { id }, data: input });
  
  const tags = [
    CACHE_TAGS.patient.byId(id),
    CACHE_TAGS.patient.byClinic(patient.clinicId)
  ];
  
  logCacheInvalidation(tags, `Patient ${id} updated`);
  
  tags.forEach(tag => revalidateTag(tag));
  
  return patient;
}
```

---

## 🚀 Performance Optimization Checklist

### Database Layer
- [ ] Add indexes on frequently queried columns
- [ ] Use `select` to fetch only needed fields
- [ ] Implement pagination for large datasets
- [ ] Use database connection pooling
- [ ] Monitor slow queries with Prisma logging

### Caching Layer
- [ ] Cache hit rate >80% for stable data
- [ ] Appropriate `cacheLife` for each data type
- [ ] Hierarchical cache tags for efficient invalidation
- [ ] No runtime APIs in cache scopes
- [ ] Cache warming for common queries

### Application Layer
- [ ] Parallel prefetching in Server Components
- [ ] Suspense boundaries for slow queries
- [ ] Optimistic updates for mutations
- [ ] Request deduplication with `cache()`
- [ ] Code splitting for large components

### Network Layer
- [ ] Enable HTTP/2 or HTTP/3
- [ ] Use CDN for static assets
- [ ] Compress responses (gzip/brotli)
- [ ] Implement service worker for offline support
- [ ] Use WebSockets for real-time features

---

## 📈 Scaling Recommendations

### For 100-1,000 Users
- ✅ Current architecture is sufficient
- ✅ Single database instance
- ✅ In-memory caching (Next.js cache)
- ✅ Vercel/Netlify deployment

### For 1,000-10,000 Users
- ✅ Add Redis for distributed caching
- ✅ Database read replicas
- ✅ CDN for static assets
- ✅ Horizontal scaling (multiple instances)

### For 10,000+ Users
- ✅ Database sharding by clinic
- ✅ Separate read/write databases
- ✅ Message queue for async operations
- ✅ Microservices for heavy operations
- ✅ Edge caching with Cloudflare

---

## 🎓 Learning Resources

### Next.js 16 Caching
- [Official Caching Docs](https://nextjs.org/docs/app/building-your-application/caching)
- [Cache Components RFC](https://github.com/vercel/next.js/discussions/54075)
- [Partial Prerendering](https://nextjs.org/docs/app/api-reference/next-config-js/partial-prerendering)

### tRPC v11
- [Options Proxy Pattern](https://trpc.io/docs/client/react/useQuery)
- [Server-Side Calls](https://trpc.io/docs/server/server-side-calls)
- [Prefetching](https://trpc.io/docs/client/react/prefetching)

### Prisma Performance
- [Query Optimization](https://www.prisma.io/docs/guides/performance-and-optimization/query-optimization-performance)
- [Connection Pooling](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [Caching Strategies](https://www.prisma.io/docs/guides/performance-and-optimization/caching)

---

## ✅ Implementation Priority

### Week 1: Foundation
1. Create `lib/cache/tags.ts` with all cache tags
2. Create `lib/cache/profiles.ts` with cache lifetimes
3. Implement `lib/cache/helpers.ts` for type-safe invalidation
4. Document caching strategy

### Week 2: Layer Separation
1. Split all `*.cache.ts` files (remove Prisma calls)
2. Ensure all `*.query.ts` files are pure Prisma
3. Update all `*.action.ts` to use centralized tags
4. Add request deduplication with `cache()`

### Week 3: Presentation Layer
1. Migrate Server Components to use prefetch
2. Add Suspense boundaries to slow queries
3. Implement optimistic updates
4. Create skeleton components

### Week 4: Optimization
1. Add cache monitoring
2. Implement cache warming
3. Profile and optimize slow queries
4. Add performance monitoring

---

**Remember**: Perfect is the enemy of good. Start with the foundation, iterate, and measure results.
# 🃏 CACHE PATTERN QUICK REFERENCE

## File Responsibilities

| File | Purpose | Forbidden |
|------|---------|-----------|
| *.query.ts | Raw Prisma | Business logic, Cache, Auth |
| *.cache.ts | 'use cache' only | Prisma, Business logic |
| *.service.ts | Business logic | Prisma, 'use cache' |
| *.actions.ts | Auth + Validation | Prisma, Business logic |

## Cache Lifecycle

1. **READ**: Server Component → *.cache.ts → *.service.ts → *.query.ts
2. **WRITE**: Action → *.actions.ts → *.service.ts → *.query.ts → *.cache.ts (invalidate)

## Invalidation Rules

- 🟢 CREATE: Invalidate LIST + CLINIC
- 🔵 UPDATE: Invalidate SPECIFIC + LIST + CLINIC
- 🔴 DELETE: Invalidate SPECIFIC + LIST + CLINIC
- 🟡 BULK: Invalidate ALL + CLINIC
# 🔍 Cache PR Review Checklist

- [ ] No `prisma` or `db.` imports in `.cache.ts` files
- [ ] No `'use cache'` directive in `.query.ts` or `.service.ts` files
- [ ] No business logic (if/else, throw) in `.query.ts` files
- [ ] All queries wrapped with `dedupeQuery()`
- [ ] Cache tags follow hierarchical pattern
- [ ] Cache helpers used instead of direct `revalidateTag`
- [ ] Second `profile` argument provided to all `revalidateTag` calls
- [ ] Cache invalidation includes ALL related tags