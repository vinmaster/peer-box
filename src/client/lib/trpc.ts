import { createTRPCClient } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../../server/routes/trpc';

export const client = createTRPCClient<AppRouter>({
  url: (import.meta as any).env.DEV
    ? `${window.location.protocol}//${window.location.hostname}:8000/trpc`
    : `${window.location.origin}/trpc`,
  transformer: superjson,
});
