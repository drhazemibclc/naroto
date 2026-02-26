# Next.js 16 Migration Quick Reference

## 🚀 Quick Start Checklist

### Before Migration
- [ ] Node.js 20.9+ installed
- [ ] TypeScript 5.1.0+ installed
- [ ] Backup your project
- [ ] Review breaking changes below

### Migration Steps
```bash
# 1. Run the codemod
npx @next/codemod@canary upgrade latest

# 2. Update dependencies
npm install next@latest react@latest react-dom@latest
npm install -D @types/react@latest @types/react-dom@latest

# 3. Generate types
npx next typegen

# 4. Test build
npm run build
```

---

## ⚠️ Critical Breaking Changes

### 1. Async Request APIs (MUST FIX)
```typescript
// ❌ BEFORE (Next.js 15)
export default function Page({ params, searchParams }) {
  const id = params.id
}

// ✅ AFTER (Next.js 16)
export default async function Page(props: PageProps) {
  const params = await props.params
  const searchParams = await props.searchParams
  const id = params.id
}
```

**Affected APIs:**
- `cookies()`, `headers()`, `draftMode()`
- `params` in all route files
- `searchParams` in pages
- `id` in metadata image files

### 2. Middleware → Proxy
```bash
# Rename file
mv middleware.ts proxy.ts
```

```typescript
// ✅ Update export
export async function proxy(request: NextRequest) {
  // your logic
}

export const config = {
  matcher: ['/((?!api/|_next/).*)']
}
```

### 3. Turbopack Configuration
```typescript
// ❌ BEFORE
const nextConfig = {
  experimental: {
    turbopack: { /* config */ }
  }
}

// ✅ AFTER
const nextConfig = {
  turbopack: { /* config */ }
}
```

### 4. Remove Deprecated Features
```typescript
// ❌ Remove these
import { useAmp } from 'next/amp'
export const config = { amp: true }

// ❌ Remove runtime config
module.exports = {
  serverRuntimeConfig: {},
  publicRuntimeConfig: {}
}

// ❌ Remove experimental flags
experimental: {
  dynamicIO: true,  // Use cacheComponents instead
  ppr: true         // Use cacheComponents instead
}
```

---

## 📦 Package.json Updates

```json
{
  "scripts": {
    "dev": "next dev",           // Remove --turbopack
    "build": "next build",       // Remove --turbopack
    "lint": "eslint .",          // Use ESLint directly
    "format": "biome format --write ."
  }
}
```

---

## 🎨 Image Component Changes

```typescript
// Update config for new defaults
const nextConfig = {
  images: {
    minimumCacheTTL: 14400,      // Now 4 hours (was 60s)
    imageSizes: [32, 48, 64, 96, 128, 256, 384], // 16 removed
    qualities: [75],              // Now single quality
    maximumRedirects: 3,          // Now limited (was unlimited)
    
    // Use remotePatterns instead of domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'example.com'
      }
    ]
  }
}
```

---

## 🔄 Cache API Updates

```typescript
// ✅ Remove unstable_ prefix
import { cacheLife, cacheTag } from 'next/cache'

// ✅ New revalidateTag signature
revalidateTag('article-123', 'max')

// ✅ New APIs
import { updateTag, refresh } from 'next/cache'

// Immediate refresh (read-your-writes)
updateTag('user-profile')

// Refresh client router
refresh()
```

---

## 🔐 Better-Auth Specific

### Role Handling
```typescript
// ✅ Always use lowercase in app layer
type Role = 'admin' | 'doctor' | 'staff' | 'patient'

// ✅ Better-Auth returns lowercase
const role = session.user.role.toLowerCase() as Role
```

### Session Management
```typescript
// ✅ Server Components
import { getSession } from '@/lib/auth/server'
const session = await getSession()

// ✅ Client Components
'use client'
import { useSession } from '@/components/providers/session-provider'
const { user, role, isAuthenticated } = useSession()

// ❌ NEVER in root layout
export default async function RootLayout() {
  const session = await getSession() // ❌ Blocks rendering
}
```

---

## 📝 TypeScript Helpers

```bash
# Generate type helpers
npx next typegen
```

```typescript
// Use generated types
import type { PageProps, LayoutProps, RouteContext } from '.next/types'

export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
}
```

---

## 🧪 Testing After Migration

```bash
# 1. Type check
npx tsc --noEmit

# 2. Lint
npx eslint .

# 3. Build
npm run build

# 4. Dev server
npm run dev
```

### Manual Testing Checklist
- [ ] All pages load without errors
- [ ] Authentication flows work
- [ ] Role-based routing works
- [ ] Image optimization works
- [ ] API routes respond correctly
- [ ] No hydration errors in console
- [ ] Session persists across refreshes

---

## 🐛 Common Issues & Fixes

### Issue: "Cannot read properties of undefined (reading 'some')"
```typescript
// ✅ Add defensive checks
if (!Array.isArray(PUBLIC_ROUTES)) {
  console.error('Routes not defined')
  return NextResponse.next()
}
```

### Issue: "Blocking Route" warning
```typescript
// ❌ Don't fetch in root layout
async function RootLayout() {
  const session = await getSession() // ❌
}

// ✅ Use client-side session
function RootLayout() {
  return <SessionProvider>{children}</SessionProvider> // ✅
}
```

### Issue: Role-based access not working
```typescript
// ✅ Ensure lowercase roles throughout
const userRole = session?.user?.role?.toLowerCase() as Role
```

### Issue: Webpack config found
```bash
# Use Turbopack anyway
npm run build -- --turbopack

# Or keep using Webpack
npm run build -- --webpack
```

---

## 📚 Additional Resources

- [Full Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Codemods](https://nextjs.org/docs/app/guides/upgrading/codemods#160)
- [Better-Auth Docs](https://better-auth.com)
- [React 19.2 Release](https://react.dev/blog/2025/10/01/react-19-2)

---

## 🎯 Project-Specific Notes

### Current Setup
- ✅ Proxy file created (`src/proxy.ts`)
- ✅ Middleware entry point (`src/middleware.ts`)
- ✅ Role normalization (lowercase)
- ✅ Non-blocking layout
- ✅ Defensive route checks

### Next Steps
1. Update to Next.js 16 when ready
2. Run codemod for async APIs
3. Test all authentication flows
4. Monitor for any edge cases
5. Update deployment configuration

---

**Last Updated**: 2026-01-05  
**Next.js Target Version**: 16.x  
**Current Status**: Ready for migration
