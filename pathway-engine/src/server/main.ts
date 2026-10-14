/**
 * Entry point: load settings, open the database, seed it if empty, start the API.
 */
import { openDb } from './db/db';
import { createCtx } from './context';
import { createApp } from './app';
import { loadSettings } from './settings';

const settings = loadSettings();
const db = await openDb({ databaseUrl: settings.databaseUrl, dataDir: process.env.PGLITE_DIR ?? `${settings.dataDir}/pglite` });
const ctx = await createCtx(db, settings);
createApp(ctx).listen(settings.port, () => {
  console.log(`Pathway Engine API on http://localhost:${settings.port} (${db.kind})`);
  if (!settings.production) console.log(`Local staff access codes and platform key are in ${settings.dataDir}/dev-secrets.json`);
});
