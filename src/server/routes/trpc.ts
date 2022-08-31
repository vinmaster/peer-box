import { createRouter } from '../lib/context';
import { z } from 'zod';
import superjson from 'superjson';
import { TRPCError } from '@trpc/server';
import { Manager } from '../lib/manager';

const authMiddleware = async ({ ctx, next, meta }: any) => {
  if (meta?.auth && !ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', cause: 'cause' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
};

const createProtectedRouter = () => createRouter().middleware(authMiddleware);

const roomRoutes = createRouter()
  .query('list', {
    async resolve() {
      return Manager.list();
    },
  })
  .mutation('create', {
    async resolve({ input, ctx }) {
      return Manager.create();
    },
  });

const adminRoutes = createProtectedRouter().query('protected', {
  async resolve(req) {
    return 'ok';
  },
});

export const appRouter = createRouter()
  .transformer(superjson)
  .middleware(async ({ path, type, next }) => {
    let start = Date.now();
    let result = await next();
    let duration = Date.now() - start;
    result.ok
      ? console.log('OK', { path, type, duration })
      : console.log('Non-OK', { path, type, duration });

    return result;
  })
  .merge('room.', roomRoutes)
  .merge('admin.', adminRoutes);

export type AppRouter = typeof appRouter;
