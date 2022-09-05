import { createTRPCClient } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../../server/routes/trpc';
import { Util } from './util';

export const client = createTRPCClient<AppRouter>({
  url: Util.IS_DEV
    ? `${window.location.protocol}//${window.location.hostname}:8000/trpc`
    : `${window.location.origin}/trpc`,
  transformer: superjson,
});
