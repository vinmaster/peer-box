declare module 'fastify' {
  interface FastifyInstance {
    config: {
      JWT_SECRET: string;
    };
  }
}
