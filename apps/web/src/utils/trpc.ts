import type { AppRouter } from '@naroto/api/routers/index';
import { QueryCache, QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { toast } from 'sonner';
import superjson from 'superjson';
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      toast.error(error.message, {
        action: {
          label: 'retry',
          onClick: query.invalidate
        }
      });
    }
  })
});

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include'
        });
      },
      transformer: superjson
    })
  ]
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient
});
