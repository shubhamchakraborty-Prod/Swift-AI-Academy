/**
 * Admin console (screens AD01-AD05): course onboarding (draft -> validate -> simulate ->
 * activate as a new minor data version), config versions (simulate on 20 reference learners, save, activate, roll back)
 * and read-only catalogue views. Existing learner plans never change when something is activated.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { Ctx } from '../context';
import { logEvent } from '../context';
import { newId } from '../crypto';
import { badRequest, HttpError, notFound } from '../errors';
import { SEED_DIR } from '../referenceData';
import { referenceInput, runEngine, validateCourse, type Course, type EngineConfig, type ReferenceData, type ReferenceLearner } from '../../engine';

const level = z.number().min(0).max(8).refine((x) => Number.isInteger(x * 2), 'Levels go in steps of 0.5');
const rule = z.object({ field: z.string(), op: z.enum(['>=', '<=', '==', 'in']), value: z.union([z.number(), z.string(), z.array(z.union([z.number(), z.string()]))]) });

/** Section 18 onboarding template as a typed draft. */
export const courseDraftSchema = z.object({
  course_id: z.string().trim().toUpperCase(),
  title: z.string().trim().min(3).max(120),
  series_id: z.string().trim().min(2).max(10),
  provider: z.string().trim().default('In-house'),
  nsqf_level: z.object({ min: level, max: level }),
  level_out: level,
  hours: z.object({ training: z.number().min(0), assessment: z.number().min(0), total: z.number().positive(), status: z.string().optional() }).nullable(),
  entry_level: level,
  entry_ladder: z.enum(['ai', 'comm']),
  prerequisites: z.object({ hard: z.array(z.string()), soft: z.array(z.string()) }),
  eligibility: z.array(z.array(rule)).default([]),
  delivery: z.object({ modes: z.array(z.string()).nullable(), offline_ok: z.boolean().nullable(), device_min: z.string().nullable(), languages: z.array(z.string()).nullable() }),
  terminal_outcome: z.string().trim().min(10).max(300),
  pitched_at: z.string().nullable().optional(),
  modules: z.array(z.object({
    title: z.string().trim().min(2),
    hours: z.number().nullable().optional(),
    outcomes: z.array(z.object({ lo_id: z.string(), text: z.string().trim().min(3), type: z.enum(['theory', 'practical']).optional(), skill_ids: z.array(z.string()) })).optional(),
  })),
  assessment_gate: z.string().nullable().optional(),
  skills: z.array(z.object({ skill_id: z.string(), level_out: level, primary: z.boolean(), evidence: z.string().nullable().optional() })),
});

export function bumpVersion(v: string, kind: 'major' | 'minor' | 'patch'): string {
  const [ma, mi, pa] = v.replace(/^v/, '').split('.').map(Number);
  if (kind === 'major') return `v${ma + 1}.0.0`;
  if (kind === 'minor') return `v${ma}.${mi + 1}.0`;
  return `v${ma}.${mi}.${pa + 1}`;
}

async function latestVersion(ctx: Ctx, table: 'reference_version' | 'engine_config'): Promise<string> {
  const rows = await ctx.db.query<{ version: string }>(`select version from ${table}`);
  return rows.map((r) => r.version).sort((a, b) => {
    const pa = a.slice(1).split('.').map(Number);
    const pb = b.slice(1).split('.').map(Number);
    return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
  }).pop()!;
}

// ---------- Reference learners and simulation (AD02, FR-25) ----------

export function referenceLearners(): ReferenceLearner[] {
  return JSON.parse(readFileSync(join(SEED_DIR, 'reference_learners.json'), 'utf8')).learners;
}

export function simulate(base: { ref: ReferenceData; config: EngineConfig }, candidate: { ref: ReferenceData; config: EngineConfig }) {
  const orientations = base.ref.career_goals.orientations.map((o) => o.id);
  return referenceLearners().map((rl) => {
    const input = referenceInput(rl, orientations);
    const summarise = (r: ReturnType<typeof runEngine>) => ({ persona: r.persona.persona_code, goals: r.goals.targets.map((g) => g.goal_id), terms: r.pathway.terms.map((t) => t.course_id) });
    const before = summarise(runEngine(input, base.ref, base.config));
    const after = summarise(runEngine(input, candidate.ref, candidate.config));
    return { id: rl.id, label: rl.label, before, after, changed: JSON.stringify(before) !== JSON.stringify(after) };
  });
}

// ---------- Courses (AD01, AD02, Step 15) ----------

export async function listCourses(ctx: Ctx) {
  const { ref } = await ctx.versions.active();
  const drafts = await ctx.db.query<{ course_id: string; data: Course; validation: unknown; simulation: unknown; updated_at: Date }>('select * from course_draft order by course_id');
  return {
    reference_version: ref.version,
    courses: ref.courses.courses.map((c) => ({ ...c, draft: drafts.find((d) => d.course_id === c.course_id) ?? null })),
    new_drafts: drafts.filter((d) => !ref.courses.courses.some((c) => c.course_id === d.course_id)),
    skills: ref.skills.skills.filter((s) => s.status === 'active').map((s) => ({ skill_id: s.skill_id, name: s.name, family_id: s.family_id })),
    series: ref.courses.series,
  };
}

export async function saveCourseDraft(ctx: Ctx, body: unknown) {
  const parsed = courseDraftSchema.safeParse(body);
  if (!parsed.success) throw badRequest('Some fields need attention', parsed.error.flatten());
  const course = parsed.data;
  await ctx.db.query(
    `insert into course_draft (course_id, data, updated_by) values ($1, $2::jsonb, 'admin')
     on conflict (course_id) do update set data = excluded.data, validation = null, simulation = null, updated_at = now()`,
    [course.course_id, JSON.stringify(course)],
  );
  return { course_id: course.course_id };
}

async function draftCourse(ctx: Ctx, courseId: string): Promise<Course> {
  const [row] = await ctx.db.query<{ data: Course }>('select data from course_draft where course_id = $1', [courseId]);
  if (row) return { ...row.data, status: 'active', version: row.data.version ?? 1 };
  const { ref } = await ctx.versions.active();
  const c = ref.courses.courses.find((x) => x.course_id === courseId);
  if (!c) throw notFound('Course not found');
  return { ...c, status: 'active' };
}

function withCourse(ref: ReferenceData, course: Course): ReferenceData {
  const exists = ref.courses.courses.some((c) => c.course_id === course.course_id);
  return {
    ...ref,
    courses: {
      ...ref.courses,
      series: ref.courses.series.some((s) => s.series_id === course.series_id) ? ref.courses.series : [...ref.courses.series, { series_id: course.series_id, name: course.series_id, ladder: course.entry_ladder }],
      courses: exists ? ref.courses.courses.map((c) => (c.course_id === course.course_id ? course : c)) : [...ref.courses.courses, course],
    },
  };
}

export async function validateDraft(ctx: Ctx, courseId: string) {
  const { ref } = await ctx.versions.active();
  const course = await draftCourse(ctx, courseId);
  const live = ref.courses.courses.find((c) => c.course_id === courseId);
  const result = validateCourse(course, ref, { isNew: !live, retiredIds: ref.courses.courses.filter((c) => c.status === 'retired').map((c) => c.course_id) });
  await ctx.db.query('update course_draft set validation = $2::jsonb where course_id = $1', [courseId, JSON.stringify(result)]);
  return result;
}

export async function simulateDraft(ctx: Ctx, courseId: string) {
  const active = await ctx.versions.active();
  const course = await draftCourse(ctx, courseId);
  const result = simulate(active, { ref: withCourse(active.ref, course), config: active.config });
  await ctx.db.query('update course_draft set simulation = $2::jsonb where course_id = $1', [courseId, JSON.stringify(result)]);
  return result;
}

/** Activate: validated and simulated drafts become a new minor reference version. Existing plans stay. */
export async function activateDraft(ctx: Ctx, courseId: string) {
  const [row] = await ctx.db.query<{ validation: { ok: boolean } | null; simulation: unknown }>('select validation, simulation from course_draft where course_id = $1', [courseId]);
  if (!row) throw notFound('No draft for this course');
  if (!row.validation?.ok) throw new HttpError(409, 'not_validated', 'Run validation and fix every failed check first');
  if (!row.simulation) throw new HttpError(409, 'not_simulated', 'Run the simulation on the reference learners first');
  const active = await ctx.versions.active();
  const course = await draftCourse(ctx, courseId);
  const next = bumpVersion(await latestVersion(ctx, 'reference_version'), 'minor');
  const data = { ...withCourse(active.ref, course), version: next };
  await ctx.db.tx(async (q) => {
    await q.query('update reference_version set active = false where active');
    await q.query(`insert into reference_version (version, data, active, base_version, note, created_by) values ($1, $2::jsonb, true, $3, $4, 'admin')`, [next, JSON.stringify(data), active.ref.version, `Course ${courseId} activated`]);
    await q.query('delete from course_draft where course_id = $1', [courseId]);
    await logEvent(q, { id: newId('E'), type: 'course_added', payload: { course_id: courseId, version: next }, actor: 'admin' });
  });
  ctx.versions.invalidate();
  return { version: next };
}

// ---------- Config and reference versions (AD05) ----------

export async function listVersions(ctx: Ctx) {
  const cfg = await ctx.db.query('select version, active, base_version, note, created_by, created_at from engine_config order by created_at');
  const ref = await ctx.db.query('select version, active, base_version, note, created_by, created_at from reference_version order by created_at');
  const { config } = await ctx.versions.active();
  return { config_versions: cfg, reference_versions: ref, active_config: config };
}

export const configChangeSchema = z.object({ note: z.string().trim().min(3).max(300), config: z.record(z.unknown()) });

export async function simulateConfig(ctx: Ctx, candidate: EngineConfig) {
  const active = await ctx.versions.active();
  return simulate(active, { ref: active.ref, config: candidate });
}

export async function createConfigVersion(ctx: Ctx, body: z.infer<typeof configChangeSchema>) {
  const active = await ctx.versions.active();
  const candidate = { ...(body.config as unknown as EngineConfig) };
  // A candidate must run on every reference learner before it can be stored (config safety).
  let sim;
  try { sim = await simulateConfig(ctx, candidate); } catch (e) { throw badRequest(`This config does not run: ${(e as Error).message}`); }
  const next = bumpVersion(await latestVersion(ctx, 'engine_config'), 'patch');
  await ctx.db.query(`insert into engine_config (version, data, active, base_version, note, created_by) values ($1, $2::jsonb, false, $3, $4, 'admin')`, [next, JSON.stringify({ ...candidate, version: next }), active.config.version, body.note]);
  await logEvent(ctx.db, { id: newId('E'), type: 'config_created', payload: { version: next, note: body.note }, actor: 'admin' });
  return { version: next, simulation: sim };
}

export async function activateVersion(ctx: Ctx, table: 'engine_config' | 'reference_version', version: string) {
  const [row] = await ctx.db.query(`select version from ${table} where version = $1`, [version]);
  if (!row) throw notFound('Version not found');
  await ctx.db.tx(async (q) => {
    await q.query(`update ${table} set active = false where active`);
    await q.query(`update ${table} set active = true where version = $1`, [version]);
    await logEvent(q, { id: newId('E'), type: `${table}_activated`, payload: { version }, actor: 'admin' });
  });
  ctx.versions.invalidate();
  return { version };
}

/** Read-only catalogue views for AD03 and AD04. */
export async function referenceOverview(ctx: Ctx) {
  const { ref } = await ctx.versions.active();
  return {
    version: ref.version,
    skills: ref.skills,
    goal_areas: ref.career_goals.goal_areas,
    goal_skills: ref.career_goals.goal_skills,
    items: { part_a: ref.items.part_a, part_b: ref.items.part_b, part_c: ref.items.part_c, part_d: ref.items.part_d },
  };
}
