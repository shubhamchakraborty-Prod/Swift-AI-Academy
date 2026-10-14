/**
 * Shared server context: database, settings, encryption, staff tokens and versioned data.
 * Reference data (catalogue + item bank) and engine config are stored as versioned snapshots. Exactly one of each
 * is active; every run records which versions it used, so changes never alter past results.
 * ensureSeed() is the v1.0.0 migration: it loads seed/v1 into an empty database.
 */
import type { Db } from './db/db';
import type { EngineConfig, ReferenceData } from '../engine/types';
import { FieldCipher, StaffTokens } from './crypto';
import type { Settings } from './settings';
import { loadSeed, SEED_REFERENCE_VERSION } from './referenceData';
import { notFound } from './errors';

export interface Versions {
  active(): Promise<{ ref: ReferenceData; config: EngineConfig }>;
  reference(version: string): Promise<ReferenceData>;
  config(version: string): Promise<EngineConfig>;
  invalidate(): void;
}

export interface Ctx {
  db: Db;
  settings: Settings;
  cipher: FieldCipher;
  staff: StaffTokens;
  versions: Versions;
  /** Injectable clock for calendar logic (age, retake windows, term dates). Never used in scoring. */
  now: () => Date;
}

/** Loads seed data into an empty database (the v1.0.0 migration). */
export async function ensureSeed(db: Db): Promise<void> {
  const { reference, config } = loadSeed();
  const refRows = await db.query('select 1 from reference_version limit 1');
  if (!refRows.length) {
    await db.query(`insert into reference_version (version, data, active, note, created_by) values ($1, $2::jsonb, true, 'Seed v1', 'migration') on conflict (version) do nothing`, [SEED_REFERENCE_VERSION, JSON.stringify(reference)]);
  }
  const cfgRows = await db.query('select 1 from engine_config limit 1');
  if (!cfgRows.length) {
    await db.query(`insert into engine_config (version, data, active, note, created_by) values ($1, $2::jsonb, true, 'Seed v1', 'migration') on conflict (version) do nothing`, [config.version, JSON.stringify(config)]);
  }
}

export function createVersions(db: Db): Versions {
  let cache: { ref: ReferenceData; config: EngineConfig } | null = null;
  const refCache = new Map<string, ReferenceData>();
  const cfgCache = new Map<string, EngineConfig>();
  const reference = async (version: string) => {
    if (!refCache.has(version)) {
      const [row] = await db.query<{ data: ReferenceData }>('select data from reference_version where version = $1', [version]);
      if (!row) throw notFound(`Reference data ${version} not found`);
      refCache.set(version, { ...row.data, version });
    }
    return refCache.get(version)!;
  };
  const config = async (version: string) => {
    if (!cfgCache.has(version)) {
      const [row] = await db.query<{ data: EngineConfig }>('select data from engine_config where version = $1', [version]);
      if (!row) throw notFound(`Config ${version} not found`);
      cfgCache.set(version, { ...row.data, version });
    }
    return cfgCache.get(version)!;
  };
  return {
    reference,
    config,
    invalidate: () => (cache = null),
    async active() {
      if (!cache) {
        const [r] = await db.query<{ version: string }>('select version from reference_version where active');
        const [c] = await db.query<{ version: string }>('select version from engine_config where active');
        cache = { ref: await reference(r.version), config: await config(c.version) };
      }
      return cache;
    },
  };
}

export async function createCtx(db: Db, settings: Settings, now: () => Date = () => new Date()): Promise<Ctx> {
  await ensureSeed(db);
  return {
    db,
    settings,
    cipher: new FieldCipher(settings.encryptionKey),
    staff: new StaffTokens(settings.sessionSecret),
    versions: createVersions(db),
    now,
  };
}

export async function logEvent(q: { query: Db['query'] }, e: { learner_id?: string | null; type: string; payload?: unknown; actor: string; id: string }) {
  await q.query('insert into event_log (event_id, learner_id, type, payload, actor) values ($1, $2, $3, $4::jsonb, $5)', [e.id, e.learner_id ?? null, e.type, JSON.stringify(e.payload ?? {}), e.actor]);
}
