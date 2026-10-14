import type { AddressInfo } from 'node:net';
import { randomBytes } from 'node:crypto';
import { openDb } from '../../src/server/db/db';
import { createCtx } from '../../src/server/context';
import { createApp } from '../../src/server/app';
import type { Settings } from '../../src/server/settings';
import { loadSeed } from '../../src/server/referenceData';

export const settings: Settings = {
  port: 0, production: false, dataDir: '.data/test', encryptionKey: randomBytes(32), sessionSecret: 'test-secret',
  mentorCode: 'mentor-code', adminCode: 'admin-code', platformKey: 'platform-key',
};

/** Embedded Postgres in memory by default; set TEST_DATABASE_URL to run the same tests on real Postgres. */
async function freshDb() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return openDb({ dataDir: 'memory' });
  const pg = (await import('pg')).default;
  const name = `pathway_test_${randomBytes(4).toString('hex')}`;
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();
  const u = new URL(url);
  u.pathname = `/${name}`;
  return openDb({ databaseUrl: u.toString() });
}

export async function startServer(now: () => Date = () => new Date('2026-10-13T09:00:00Z')) {
  const db = await freshDb();
  const ctx = await createCtx(db, settings, now);
  const server = createApp(ctx).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json as any };
  };
  return { ctx, db, call, close: async () => { server.close(); await db.close(); } };
}

const { reference } = loadSeed();
export const correctAnswer = (itemId: string) => reference.items.part_c.find((i) => i.item_id === itemId)!.answer;
export const wrongAnswer = (itemId: string) => reference.items.part_c.find((i) => i.item_id === itemId)!.options.find((o) => o.value !== correctAnswer(itemId))!.value;

/** Answers a learner can give to Part A, as profile field values. */
export const partA = {
  A3: { gender: 'woman' },
  A4: { location: { state: 'Bihar', district: 'Patna' } },
  A5: { learning_language: 'en' },
  A6: { current_status: 'college' },
  A7: { education_stage: 'ug_2' },
  A8: { time_left: 'about_1' },
  A9: { field_of_study: 'bcom' },
  A10: { certificates: ['none'] },
  A11: { work_experience: 'none' },
  A12: { device: 'phone_and_laptop' },
  A13: { internet: 'reliable' },
  A14: { weekly_hours: '3_to_5' },
} as Record<string, Record<string, unknown>>;

/** Item-level Part B answers that give Learner A's scale means (Data 4.25, People 3.5, ...). */
export const learnerAPartB: Record<string, number> = {
  'LP-P1': 4, 'LP-P2': 3, 'LP-P3': 4, 'LP-P4': 3,
  'LP-D1': 5, 'LP-D2': 4, 'LP-D3': 4, 'LP-D4': 4,
  'LP-I1': 3, 'LP-I2': 3, 'LP-I3': 3, 'LP-I4': 3,
  'LP-T1': 2, 'LP-T2': 2, 'LP-T3': 3, 'LP-T4': 2,
  'LP-SD1': 4, 'LP-SD2': 4, 'LP-SD3': 4, 'LP-SD4': 3, 'LP-SD5': 4, // SD4 reverse -> 3; mean 3.8
  'LP-LI1': 4, 'LP-LI2': 4, 'LP-LI3': 2, 'LP-LI4': 4, // LI3 reverse -> 4; mean 4
  'LP-LM1': 4, 'LP-LM2': 4, 'LP-LM3': 3, 'LP-LM4': 4, // LM3 reverse -> 3; mean 3.75
  'LP-GC1': 3, 'LP-GC2': 3, 'LP-GC3': 3, // mean 3
  'LP-CE1': 3, 'LP-CE2': 3, 'LP-CE3': 3,
  'LP-CT1': 3, 'LP-CT2': 2, 'LP-CT3': 3, // mean 2.67
  'LP-Q1': 4, 'LP-Q2': 1,
};
