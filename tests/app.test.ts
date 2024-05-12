import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import fastify from '../src/server/app';

let app = await fastify();

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

it('GET /api', async () => {
  let res = await app.inject('/api');
  expect(res.statusCode).eq(200);
  expect(res.json()).deep.eq({ hello: 'world' });
});

it('GET /api/not-found', async () => {
  let res = await app.inject('/api/not-found');
  expect(res.statusCode).eq(404);
  expect(res.json()).deep.eq({ status: 404, error: 'Not Found' });
});
