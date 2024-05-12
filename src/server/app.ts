import path from 'path';
import fastify, { FastifyServerOptions } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import staticFiles from '@fastify/static';
import env from '@fastify/env';
import socketioServer from 'fastify-socket.io';
import { apiRoutes } from './routes/api';
import { appErrorHandler, appNotFoundHandler } from './routes/default';
import { wsRoutes } from './routes/ws';

const envOptions = {
  dotenv: {
    path: path.join(
      __dirname,
      '../..',
      `.env.${process.env.NODE_ENV?.toLowerCase() === 'production' ? 'production' : 'development'}`
    ),
  },
  schema: {
    type: 'object',
    required: ['DOMAIN'],
    properties: {
      DOMAIN: { type: 'string' },
    },
  },
};

export default async (opts?: FastifyServerOptions) => {
  const app = fastify(opts);

  await app.register(env, envOptions);
  // app.register(helmet, { contentSecurityPolicy: false });
  app.register(cors);
  app.register(staticFiles, { root: path.join(__dirname, 'public') });
  app.register(socketioServer, {
    cors: {
      origin: (process.env.DOMAIN ?? '').split(','),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
  });
  app.register(apiRoutes, { prefix: 'api' });
  app.register(wsRoutes);
  app.setErrorHandler(appErrorHandler);
  app.setNotFoundHandler(appNotFoundHandler);

  return app;
};
