/**
 * Netlify Function that serves the whole /v1 API.
 * Built by `npm run build:function` into netlify/functions/api.mjs (one self-contained file with a
 * require() shim, because Express needs it inside an ES module bundle). Do not put source files in netlify/functions.
 * Netlify rewrites /v1/* to this function (see netlify.toml); the Express app from src/server/app.ts handles it.
 * The database must be hosted Postgres (Netlify DB or any DATABASE_URL), because function files do not persist.
 * The app context is created once per warm instance and reused across requests.
 */
import serverless from 'serverless-http';
import { openDb } from '../src/server/db/db';
import { createCtx } from '../src/server/context';
import { createApp } from '../src/server/app';
import { loadSettings } from '../src/server/settings';

let ready: Promise<ReturnType<typeof serverless>> | null = null;

function init() {
  const settings = loadSettings();
  if (!settings.databaseUrl) throw new Error('Set DATABASE_URL (or enable Netlify DB) before deploying the API');
  return openDb({ databaseUrl: settings.databaseUrl })
    .then((db) => createCtx(db, settings))
    .then((ctx) =>
      serverless(createApp(ctx), {
        // Depending on how the rewrite reaches the function, the path may carry the function prefix; normalise it.
        request: (req: { url: string }) => { req.url = req.url.replace(/^\/\.netlify\/functions\/api/, '/v1'); },
      }),
    );
}

export const handler = async (event: unknown, context: unknown) => {
  ready ??= init().catch((e) => { ready = null; throw e; });
  return (await ready)(event as never, context as never);
};
