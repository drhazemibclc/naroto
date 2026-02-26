Act as a Senior Full Stack Engineer. When generating or refactoring React components using tRPC, you MUST strictly follow this TanStack Query v5 implementation pattern:

### 1. Hook Initialization
- Always initialize the tRPC proxy using: `const trpc = useTRPC();`
- Always initialize the Query Client using: `const queryClient = useQueryClient();`

### 2. Data Fetching (useQuery)
- Do NOT use `trpc.useQuery(...)`. 
- INSTEAD, use the standard TanStack `useQuery` hook with `queryOptions()`:
  `const { data } = useQuery(trpc.procedureName.queryOptions({ input }));`

### 3. Mutations (useMutation)
- Do NOT use `trpc.useMutation(...)`.
- INSTEAD, use the standard TanStack `useMutation` hook with `mutationOptions()`:
  `const mutation = useMutation(trpc.procedureName.mutationOptions({ onSuccess: () => { ... } }));`

### 4. Cache Invalidation
- Perform invalidations inside `onSuccess` using the `queryOptions()` key to ensure type safety:
  `queryClient.invalidateQueries(trpc.procedureName.queryOptions());`

### 5. Server-Side Prefetching (Hydration)
- When prefetching in Server Components (Page/Layout), use:
  `const queryClient = getQueryClient();`
  `void queryClient.prefetchQuery(trpc.procedureName.queryOptions({ input }));`
- Wrap children in `<HydrationBoundary state={dehydrate(queryClient)}>` only when necessary.

### 6. Code Style
- Use "use client" for components utilizing these hooks.
- Favor `mutate()` for triggers and `isPending` for loading states.
- Avoid direct Prisma calls in Client Components; always route through tRPC.

Refer to this snippet as the gold standard for your output:
"use client";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { getQueryClient, trpc } from "@/trpc/server";
import {
  dehydrate,
  HydrationBoundary,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { redirect } from "next/navigation";

export default function Home() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useQuery(trpc.getWorkFlows.queryOptions());
  const create = useMutation(
    trpc.createWorkFlow.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.getWorkFlows.queryOptions());
      },
    }),
  );
  const aiTest = useMutation(trpc.testAi.mutationOptions());
  // const users = await prisma.user.findMany();
  // console.log(users);
  // const queryClient=getQueryClient()
  // void queryClient.prefetchQuery(trpc.)
  return (
    // <HydrationBoundary state={dehydrate(queryClient)}>

    // </HydrationBoundary>
    <div className=" min-h-screen min-w-screen flex items-center justify-center flex-col gap-y-6">
      {JSON.stringify(data, null, 2)}
      <Button disabled={aiTest.isPending} onClick={() => aiTest.mutate()}>
        test ai
      </Button>
      <Button disabled={create.isPending} onClick={() => create.mutate()}>
        cretae wrokflow
      </Button>
    </div>
  );
}