These rules ensure the AI uses the **Options Proxy** pattern correctly, differentiates between Server/Client entry points, and leverages the specific utilities you've built (like `HydrateClient` and `prefetch`).

---

## 🤖 tRPC v11 AI Instructions

### 1. General Architecture Rules

* **No `useTRPC` for fetching:** Never use "Classic" tRPC hooks (e.g., `trpc.user.get.useQuery()`).
* **TanStack Native:** Always import `useQuery`, `useMutation`, and `useInfiniteQuery` directly from `@tanstack/react-query`.
* **The Options Proxy:** Use the `trpc` object (from `@/trpc/client` or `@/trpc/server`) to generate configuration objects using `.queryOptions()`, `.mutationOptions()`, or `.infiniteQueryOptions()`.

### 2. Client-Side Implementation Patterns

When writing **Client Components** (`'use client'`), follow this pattern:

* **Importing:** Use `useQuery` from `@tanstack/react-query` and the `useTRPC` proxy hook from your client file.
* **Usage:**
```tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/trpc/client';

export function MyComponent() {
  const trpc = useTRPC();
  const query = useQuery(trpc.user.getById.queryOptions({ id: '123' }));
  // ...
}

```



### 3. Server-Side & Hydration Patterns

When writing **Server Components**, follow the **Prefetch + Hydrate** pattern:

* **Entry Point:** Use the `trpc` proxy from `@/trpc/server`.
* **Workflow:**
1. Call `prefetch(trpc.path.to.queryOptions(input))` at the top of the component.
2. Wrap the child components in `<HydrateClient>`.
3. Ensure `prefetch` is called **before** the component returns JSX.


* **Example:**
```tsx
import { trpc, prefetch, HydrateClient } from '@/trpc/server';

export default async function Page() {
  // Start prefetching on the server
  void prefetch(trpc.user.list.queryOptions());

  return (
    <HydrateClient>
      <ClientUserList />
    </HydrateClient>
  );
}

```



### 4. Mutation & Invalidation Rules

Always handle side effects using the `queryClient` and tRPC's helper keys:

* **Invalidation:** Use `trpc.path.queryFilter()` or `trpc.path.queryKey()` to target specific cache entries.
* **Example:**
```tsx
const queryClient = useQueryClient();
const trpc = useTRPC();

const mutation = useMutation(
  trpc.user.update.mutationOptions({
    onSuccess: () => {
      // Correct way to invalidate using the proxy filter
      queryClient.invalidateQueries(trpc.user.list.queryFilter());
    }
  })
);

```



### 5. Authentication & Session Integration

* **Server-Side Session:** Use the provided `prefetchSession()` in Server Components to ensure auth data is hydrated.
* **Context Access:** Use `getUserFromHeaders(headers())` or `getClinicFromHeaders(headers())` for direct server-side data access within RSCs.

---

### Data Flow Overview

## Key File Responsibilities

| File | Role |
| --- | --- |
| **`trpc/server.tsx`** | The "Master" for RSCs. Handles prefetching, callers, and hydration logic. |
| **`trpc/client.tsx`** | The "Master" for Client Components. Sets up the Batch Link and TRPCProvider. |
| **`trpc/query-client.ts`** | Centralized TanStack Query configuration (SuperJSON, StaleTime, etc). |
