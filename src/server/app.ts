import path from 'path';
import { fastify as Fastify, FastifyServerOptions } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import staticFiles from '@fastify/static';
import env from '@fastify/env';
import socketioServer from 'fastify-socket.io';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { createContext } from './lib/context';
import { appRouter } from './routes/trpc';
import { apiRoutes } from './routes/api';
import { appErrorHandler, appNotFoundHandler } from './routes/default';
import { wsRoutes } from './routes/ws';

const envOptions = {
  dotenv: true,
  schema: {
    type: 'object',
    required: ['DOMAIN'],
    properties: {
      DOMAIN: { type: 'string' },
      SENTRY_DSN: { type: 'string' },
    },
  },
};

export default async (opts?: FastifyServerOptions) => {
  const fastify = Fastify(opts);

  await fastify.register(env, envOptions);
  // fastify.register(helmet, { contentSecurityPolicy: false });
  fastify.register(cors);
  fastify.register(staticFiles, { root: path.join(__dirname, 'public') });
  fastify.register(socketioServer, {
    cors: {
      origin: process.env.DOMAIN,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
  });
  fastify.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: { router: appRouter, createContext },
  });
  fastify.register(apiRoutes, { prefix: 'api' });
  fastify.register(wsRoutes);
  fastify.setErrorHandler(appErrorHandler);
  fastify.setNotFoundHandler(appNotFoundHandler);

  return fastify;
};
