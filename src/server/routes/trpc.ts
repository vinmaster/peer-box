import { createRouter } from '../lib/context';
import { z } from 'zod';
import superjson from 'superjson';
import { TRPCError } from '@trpc/server';
import { WebSocketService } from './ws';

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
    async resolve({ ctx }) {
      let roomIds = [];
      for (let [roomId, room] of WebSocketService.rooms) {
        if (process.env.NODE_ENV === 'development' || (room.ip && room.ip === ctx.req.ip)) {
          roomIds.push(roomId);
        }
      }
      return roomIds;
    },
  })
  .mutation('create', {
    async resolve({ input, ctx }) {
      return WebSocketService.createRoom().roomId;
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
