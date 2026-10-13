import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import compress from '@fastify/compress';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { AccessesQuerySchema, TracksQuerySchema } from '@sat/contract';
import Fastify, { type FastifyInstance } from 'fastify';

import type { Config } from '../config';
import type { Database } from '../infra/database';
import { AccessRepository } from '../repositories/accessRepository';
import { TrackRepository } from '../repositories/trackRepository';
import { AccessService } from '../services/accessService';
import { MetaService } from '../services/metaService';
import { SatelliteCatalog } from '../services/satelliteCatalog';
import { TrackService } from '../services/trackService';
import { registerErrorHandling } from './errors';

export interface AppDeps {
  db: Database;
  config: Pick<Config, 'LOG_LEVEL' | 'CORS_ORIGIN' | 'WEB_DIST' | 'NODE_ENV'>;
}

/** Composition root: wires repositories -> services -> HTTP routes. No globals, fully testable. */
export async function buildApp({ db, config }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      config.LOG_LEVEL === 'silent'
        ? false
        : {
            level: config.LOG_LEVEL,
            ...(config.NODE_ENV === 'development'
              ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
              : {}),
          },
  });

  registerErrorHandling(app);
  await app.register(compress, { global: true, encodings: ['br', 'gzip'] });
  const origins = config.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.length) await app.register(cors, { origin: origins });

  const trackRepo = new TrackRepository(db);
  const catalog = new SatelliteCatalog(await trackRepo.listSatellites());
  const meta = new MetaService(trackRepo);
  const tracks = new TrackService(trackRepo, catalog);
  const accesses = new AccessService(new AccessRepository(db), catalog);
  const dataset = await meta.getMeta();

  // Dataset is immutable per DB build -> its fingerprint is a perfect strong validator.
  const immutable = (reply: { header: (k: string, v: string) => unknown }, extra = '') => {
    reply.header('ETag', `"${dataset.dataset.version}${extra}"`);
    reply.header('Cache-Control', 'public, max-age=3600');
  };

  app.get('/api/health', async () => ({ status: 'ok', dataset: dataset.dataset.version }));

  app.get('/api/meta', async (_req, reply) => {
    immutable(reply);
    return dataset;
  });

  app.get('/api/tracks', async (req, reply) => {
    const query = TracksQuerySchema.parse(req.query);
    const etag = `"${dataset.dataset.version}:${JSON.stringify(query)}"`;
    if (req.headers['if-none-match'] === etag) return reply.status(304).send();
    reply.header('ETag', etag);
    reply.header('Cache-Control', 'public, max-age=3600');
    return tracks.getTracks(query);
  });

  app.get('/api/accesses', async (req, reply) => {
    const query = AccessesQuerySchema.parse(req.query);
    reply.header('Cache-Control', 'private, max-age=60');
    return accesses.findAccesses(query);
  });

  // Single-container mode: serve the built SPA with an index.html fallback.
  if (config.WEB_DIST && existsSync(resolve(config.WEB_DIST))) {
    await app.register(fastifyStatic, { root: resolve(config.WEB_DIST), wildcard: false });
    app.get('/*', (req, reply) =>
      req.url.startsWith('/api/')
        ? reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
        : reply.sendFile('index.html'),
    );
  }

  return app;
}
