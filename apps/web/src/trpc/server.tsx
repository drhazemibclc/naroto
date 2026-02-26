import 'server-only';

import { createTRPCContext } from '@naroto/api/context';
import { type AppRouter, appRouter } from '@naroto/api/routers/index';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { cache } from 'react';

import { makeQueryClient } from './query-client';

export const getQueryClient = cache(() => makeQueryClient());

const createServerContext = cache(async () => {
  const heads = await headers();

  return createTRPCContext({
    headers: heads
  } as unknown as NextRequest);
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  router: appRouter,
  ctx: await createServerContext(),
  queryClient: getQueryClient
});

export async function createCaller() {
  const context = await createServerContext();
  return appRouter.createCaller(context);
}

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return <HydrationBoundary state={dehydrate(queryClient)}>{props.children}</HydrationBoundary>;
}

/**
 * Prefetch helper for RSC
 * Uses AnyTRPCRouter to avoid the ResolverDef constraint issues
 */
export function prefetch<
  T extends {
    queryKey: readonly unknown[];
    queryFn: (opts: { signal?: AbortSignal; pageParam?: unknown }) => Promise<unknown>;
  }
>(queryOptions: T) {
  const queryClient = getQueryClient();

  // Type guard for infinite queries without using 'any'
  const isInfinite =
    'queryKey' in queryOptions &&
    Array.isArray(queryOptions.queryKey) &&
    (queryOptions.queryKey[1] as { type?: string })?.type === 'infinite';

  if (isInfinite) {
    void queryClient.prefetchInfiniteQuery(queryOptions as unknown as never);
  } else {
    void queryClient.prefetchQuery(queryOptions as unknown as never);
  }
}
