import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSeed } from '../../src/server/referenceData';
import { startServer } from './harness';

let s: Awaited<ReturnType<typeof startServer>>;
let A: Record<string, string>;
beforeAll(async () => {
  s = await startServer();
  const t = await s.call('POST', '/staff/session', { role: 'admin', code: 'admin-code' });
  A = { authorization: `Bearer ${t.body.token}` };
});
afterAll(async () => { await s.close(); });

describe('admin console API', () => {
  it('rejects mentors and wrong codes', async () => {
    expect((await s.call('POST', '/staff/session', { role: 'admin', code: 'nope' })).status).toBe(401);
    const m = await s.call('POST', '/staff/session', { role: 'mentor', code: 'mentor-code' });
    expect((await s.call('GET', '/admin/courses', undefined, { authorization: `Bearer ${m.body.token}` })).status).toBe(401);
  });

  it('activates BOT-1 through the template: validate, simulate, activate (Step 15, FR-23, FR-25)', async () => {
    const list = await s.call('GET', '/admin/courses', undefined, A);
    const bot = list.body.courses.find((c: { course_id: string }) => c.course_id === 'BOT-1');
    expect(bot.status).toBe('draft');
    expect((await s.call('POST', '/admin/courses/BOT-1/activate', {}, A)).status).toBe(404); // no draft yet

    const draft = {
      ...bot, hours: { training: 40, assessment: 4, total: 44 },
      modules: [{ title: 'Design a useful bot', outcomes: bot.skills.filter((x: { primary: boolean }) => x.primary).map((x: { skill_id: string }, i: number) => ({ lo_id: `LO-${i + 1}`, text: `Show ${x.skill_id} in the capstone`, skill_ids: [x.skill_id] })) }],
    };
    expect((await s.call('POST', '/admin/courses', draft, A)).status).toBe(200);
    expect((await s.call('POST', '/admin/courses/BOT-1/activate', {}, A)).body.error).toBe('not_validated');
    const v = await s.call('POST', '/admin/courses/BOT-1/validate', {}, A);
    expect(v.body.ok, JSON.stringify(v.body.checks.filter((c: { ok: boolean }) => !c.ok))).toBe(true);
    expect((await s.call('POST', '/admin/courses/BOT-1/activate', {}, A)).body.error).toBe('not_simulated');
    const sim = await s.call('POST', '/admin/courses/BOT-1/simulate', {}, A);
    expect(sim.body).toHaveLength(20);
    const act = await s.call('POST', '/admin/courses/BOT-1/activate', {}, A);
    expect(act.body.version).toBe('v1.1.0');
    const detail = await s.call('GET', '/courses/BOT-1');
    expect(detail.body.hours.total).toBe(44);
    // Roll back in one action
    await s.call('POST', '/admin/reference/v1.0.0/activate', {}, A);
    expect((await s.call('GET', '/courses/BOT-1')).status).toBe(404);
    await s.call('POST', '/admin/reference/v1.1.0/activate', {}, A);
  });

  it('refuses a broken course template with the failing check', async () => {
    const { reference } = loadSeed();
    const base = reference.courses.courses.find((c) => c.course_id === 'AAI-2')!;
    await s.call('POST', '/admin/courses', { ...base, course_id: 'AAI-9', prerequisites: { hard: ['AAI-9'], soft: [] }, modules: [] }, A);
    const v = await s.call('POST', '/admin/courses/AAI-9/validate', {}, A);
    expect(v.body.ok).toBe(false);
    expect(v.body.checks.find((c: { id: number }) => c.id === 6).messages).toContain('A course cannot require itself');
  });

  it('creates a config version only after it runs on all reference learners, then activates it', async () => {
    const versions = await s.call('GET', '/admin/versions', undefined, A);
    const cfg = { ...versions.body.active_config, persona: { ...versions.body.active_config.persona, borderline: 0.12 } };
    const created = await s.call('POST', '/admin/config', { note: 'Borderline band 0.15 to 0.12', config: cfg }, A);
    expect(created.body.version).toBe('v1.0.1');
    expect(created.body.simulation).toHaveLength(20);
    await s.call('POST', '/admin/config/v1.0.1/activate', {}, A);
    expect((await s.call('GET', '/meta')).body.config_version).toBe('v1.0.1');
    const broken = await s.call('POST', '/admin/config', { note: 'broken', config: { version: 'x' } }, A);
    expect(broken.status).toBe(400);
  });

  it('deletes a learner on request and keeps only anonymised runs', async () => {
    const c = await s.call('POST', '/learners', { name: 'Delete Me', dob: '2000-02-02', consents: { store_answers: true, take_assessment: true } });
    const H = { authorization: `Bearer ${c.body.token}` };
    expect((await s.call('DELETE', `/learners/${c.body.learner_id}`, undefined, H)).body.deleted).toBe(true);
    expect((await s.call('GET', `/learners/${c.body.learner_id}`, undefined, H)).status).toBe(401);
    const rows = await s.db.query('select count(*)::int as n from learner where learner_id = $1', [c.body.learner_id]);
    expect(rows[0]).toEqual({ n: 0 });
  });
});
