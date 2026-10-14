/**
 * Assessment Service (Steps 2-5): saves every answer as it is given (FR-2), scores Part B,
 * serves and scores the adaptive skill check one item at a time (answer keys never leave the server), and stores Part D.
 * Each part is an assessment_attempt row; each answer is a learner_response row with its time taken.
 */
import { z } from 'zod';
import type { Ctx } from '../context';
import type { Queryable } from '../db/db';
import { newId } from '../crypto';
import { badRequest, HttpError } from '../errors';
import { aiSkillCheck, commSkillCheck, scoreLearningProfile, type PartBScores, type SkillCheckItem, type ReferenceData } from '../../engine';
import { getLearner, resolvePartA, validatePartA } from './learners';

export type Part = 'A' | 'B' | 'C_AI' | 'C_COMM' | 'D' | 'TB';

interface AttemptRow {
  attempt_id: string;
  part: Part;
  status: 'open' | 'finished';
  result: Record<string, unknown> | null;
  started_at: Date;
  finished_at: Date | null;
  reference_version: string;
}

export async function latestAttempt(q: Queryable, learnerId: string, part: Part, status?: 'open' | 'finished'): Promise<AttemptRow | null> {
  const rows = await q.query<AttemptRow>(
    `select * from assessment_attempt where learner_id = $1 and part = $2 ${status ? 'and status = $3' : ''} order by started_at desc, attempt_id desc limit 1`,
    status ? [learnerId, part, status] : [learnerId, part],
  );
  return rows[0] ?? null;
}

async function openAttempt(ctx: Ctx, learnerId: string, part: Part): Promise<AttemptRow> {
  const open = await latestAttempt(ctx.db, learnerId, part, 'open');
  if (open) return open;
  const { ref } = await ctx.versions.active();
  const id = newId('AT');
  await ctx.db.query('insert into assessment_attempt (attempt_id, learner_id, part, reference_version) values ($1, $2, $3, $4)', [id, learnerId, part, ref.version]);
  return (await latestAttempt(ctx.db, learnerId, part, 'open'))!;
}

async function responses(q: Queryable, attemptId: string) {
  return q.query<{ item_id: string; value: unknown; correct: boolean | null; ms_taken: number; answered_at: Date }>('select * from learner_response where attempt_id = $1', [attemptId]);
}

const clampMs = (ctx: { max: number }, ms: number) => Math.max(0, Math.min(Math.round(ms), ctx.max * 1000));

async function saveResponse(ctx: Ctx, attemptId: string, itemId: string, value: unknown, msTaken: number, correct: boolean | null = null) {
  const { config } = await ctx.versions.active();
  await ctx.db.query(
    `insert into learner_response (attempt_id, item_id, value, correct, ms_taken) values ($1, $2, $3::jsonb, $4, $5)
     on conflict (attempt_id, item_id) do update set value = excluded.value, correct = excluded.correct, ms_taken = excluded.ms_taken, answered_at = now()`,
    [attemptId, itemId, JSON.stringify(value), correct, clampMs({ max: config.assessment.max_item_seconds }, msTaken)],
  );
}

// ---------- Part A ----------

export const partAAnswerSchema = z.object({ item_id: z.string(), answers: z.record(z.unknown()), ms_taken: z.number().int().nonnegative().default(0) });

export async function answerPartA(ctx: Ctx, learnerId: string, body: z.infer<typeof partAAnswerSchema>) {
  const { ref } = await ctx.versions.active();
  const learner = await getLearner(ctx, learnerId);
  const item = resolvePartA(ref).find((i) => i.item_id === body.item_id);
  if (!item) throw badRequest('Unknown question', { item_id: body.item_id });
  const fields = validatePartA(item, ref, body.answers);
  const attempt = await openAttempt(ctx, learnerId, 'A');
  await saveResponse(ctx, attempt.attempt_id, item.item_id, fields, body.ms_taken);
  const profile = { ...learner.profile, ...fields };
  await ctx.db.tx(async (q) => {
    await q.query('update learner set profile = $2::jsonb, updated_at = now() where learner_id = $1', [learnerId, JSON.stringify(profile)]);
    if (item.field === 'certificates') {
      // Self-reported certificates: count as done, but raise skill levels only to the self-report cap.
      await q.query(`delete from learner_course where learner_id = $1 and source = 'self_report'`, [learnerId]);
      for (const c of (fields.certificates as string[]).filter((x) => x !== item.none_option?.value)) {
        await q.query(`insert into learner_course (learner_id, course_id, status, source) values ($1, $2, 'passed', 'self_report')`, [learnerId, c]);
      }
    }
  });
  if (resolvePartA(ref).every((i) => i.field in profile)) {
    await ctx.db.query(`update assessment_attempt set status = 'finished', finished_at = coalesce(finished_at, now()) where attempt_id = $1`, [attempt.attempt_id]);
  }
  return { profile };
}

// ---------- Part B ----------

export const partBAnswerSchema = z.object({ item_id: z.string(), value: z.number().int().min(1).max(5), ms_taken: z.number().int().nonnegative().default(0) });

export async function answerPartB(ctx: Ctx, learnerId: string, body: z.infer<typeof partBAnswerSchema>) {
  const { ref } = await ctx.versions.active();
  if (!ref.items.part_b.some((i) => i.item_id === body.item_id && i.status === 'active')) throw badRequest('Unknown statement', { item_id: body.item_id });
  const attempt = await currentPartBAttempt(ctx, learnerId, true);
  if (!attempt) throw new HttpError(409, 'not_open', 'The learning profile is already submitted');
  await saveResponse(ctx, attempt.attempt_id, body.item_id, body.value, body.ms_taken);
  return { saved: true };
}

/** The open attempt, or a new one if none was ever started. Never reopens a finished attempt. */
async function currentPartBAttempt(ctx: Ctx, learnerId: string, create: boolean): Promise<AttemptRow | null> {
  const open = await latestAttempt(ctx.db, learnerId, 'B', 'open');
  if (open) return open;
  const any = await latestAttempt(ctx.db, learnerId, 'B');
  if (any || !create) return null;
  return openAttempt(ctx, learnerId, 'B');
}

export async function submitPartB(ctx: Ctx, learnerId: string) {
  const { ref, config } = await ctx.versions.active();
  const attempt = await latestAttempt(ctx.db, learnerId, 'B', 'open');
  if (!attempt) throw new HttpError(409, 'not_open', 'There is no open learning profile to submit');
  const rows = await responses(ctx.db, attempt.attempt_id);
  const answers = Object.fromEntries(rows.map((r) => [r.item_id, Number(r.value)]));
  const seconds = rows.reduce((s, r) => s + r.ms_taken, 0) / 1000;
  let scores: PartBScores;
  try {
    scores = scoreLearningProfile(ref.items.part_b, answers, seconds, ref.career_goals.orientations.map((o) => o.id), config);
  } catch (e) {
    if (e instanceof Error && 'missing' in e) throw new HttpError(422, 'incomplete', 'Some statements are not answered yet', { missing_part: 'B', missing: (e as { missing: string[] }).missing });
    throw e;
  }
  await ctx.db.tx(async (q) => {
    await q.query('insert into learner_profile_score (attempt_id, learner_id, scores, flagged) values ($1, $2, $3::jsonb, $4)', [attempt.attempt_id, learnerId, JSON.stringify(scores), scores.flagged]);
    await q.query(`update assessment_attempt set status = 'finished', finished_at = now(), result = $2::jsonb where attempt_id = $1`, [attempt.attempt_id, JSON.stringify({ flagged: scores.flagged, flags: scores.flags, seconds })]);
  });
  return { flagged: scores.flagged };
}

/** Latest finished Part B scores (flagged or not). */
export async function partBScores(q: Queryable, learnerId: string): Promise<PartBScores | null> {
  const [row] = await q.query<{ scores: PartBScores }>(
    `select s.scores from learner_profile_score s join assessment_attempt a on a.attempt_id = s.attempt_id where s.learner_id = $1 order by a.finished_at desc limit 1`,
    [learnerId],
  );
  return row?.scores ?? null;
}

export async function partBRetakeStatus(ctx: Ctx, learnerId: string): Promise<{ eligible: boolean; available_at: string | null; used: boolean }> {
  const { config } = await ctx.versions.active();
  const attempts = await ctx.db.query<AttemptRow>(`select * from assessment_attempt where learner_id = $1 and part = 'B' order by started_at`, [learnerId]);
  const last = attempts[attempts.length - 1];
  const retakesUsed = Math.max(0, attempts.length - 1);
  if (!last || last.status !== 'finished' || !(last.result as { flagged?: boolean } | null)?.flagged) return { eligible: false, available_at: null, used: retakesUsed > 0 };
  if (retakesUsed >= config.assessment.part_b_max_retakes) return { eligible: false, available_at: null, used: true };
  const at = new Date(last.finished_at!.getTime() + config.assessment.part_b_retake_after_hours * 3_600_000);
  return { eligible: ctx.now() >= at, available_at: at.toISOString(), used: false };
}

export async function startPartBRetake(ctx: Ctx, learnerId: string) {
  const s = await partBRetakeStatus(ctx, learnerId);
  if (!s.eligible) throw new HttpError(409, 'retake_unavailable', s.available_at ? `The retake opens on ${s.available_at}` : 'A retake is not available');
  await openAttempt(ctx, learnerId, 'B');
  return { started: true };
}

// ---------- Part C: skill check ----------

const publicItem = (i: SkillCheckItem) => ({
  item_id: i.item_id,
  text: i.text_en,
  strand: i.strand,
  transcript: i.transcript_en, // played as audio; also the accessible fallback when speech is unavailable
  options: i.options.map((o) => ({ value: o.value, label: o.label_en })),
});

async function skillState(ctx: Ctx, learnerId: string, series: 'ai' | 'comm') {
  const { ref, config } = await ctx.versions.active();
  const part: Part = series === 'ai' ? 'C_AI' : 'C_COMM';
  const attempt = (await latestAttempt(ctx.db, learnerId, part)) ?? (await openAttempt(ctx, learnerId, part));
  const rows = await responses(ctx.db, attempt.attempt_id);
  const answers = Object.fromEntries(rows.map((r) => [r.item_id, Boolean(r.correct)]));
  let state;
  if (series === 'ai') state = aiSkillCheck(ref.items.part_c, answers, config);
  else {
    const learner = await getLearner(ctx, learnerId);
    const stage = learner.profile.education_stage as string | undefined;
    if (!stage) throw new HttpError(422, 'incomplete', 'Finish About you first', { missing_part: 'A' });
    state = commSkillCheck(ref.items.part_c, answers, stage, config);
  }
  if (state.done && attempt.status === 'open') {
    await ctx.db.query(`update assessment_attempt set status = 'finished', finished_at = now(), result = $2::jsonb where attempt_id = $1`, [attempt.attempt_id, JSON.stringify({ placement: state.placement, trail: state.trail })]);
  }
  return { ref, attempt, state, answered: rows.length };
}

export async function nextSkillItem(ctx: Ctx, learnerId: string, series: 'ai' | 'comm') {
  const { ref, state, answered } = await skillState(ctx, learnerId, series);
  if (state.done) return { done: true, answered };
  const item = ref.items.part_c.find((i) => i.item_id === state.next_item_id)!;
  return { done: false, answered, item: publicItem(item) };
}

export const skillAnswerSchema = z.object({ series: z.enum(['ai', 'comm']), item_id: z.string(), answer: z.string(), ms_taken: z.number().int().nonnegative().default(0) });

export async function answerSkillItem(ctx: Ctx, learnerId: string, body: z.infer<typeof skillAnswerSchema>) {
  const { ref, attempt, state } = await skillState(ctx, learnerId, body.series);
  if (state.done) throw new HttpError(409, 'done', 'This skill check is already finished');
  if (state.next_item_id !== body.item_id) throw new HttpError(409, 'out_of_order', 'Answer the current question first');
  const item = ref.items.part_c.find((i) => i.item_id === body.item_id)!;
  if (!item.options.some((o) => o.value === body.answer)) throw badRequest('Choose one of the options');
  await saveResponse(ctx, attempt.attempt_id, item.item_id, body.answer, body.ms_taken, body.answer === item.answer);
  return nextSkillItem(ctx, learnerId, body.series);
}

export async function placement(q: Queryable, learnerId: string, part: 'C_AI' | 'C_COMM'): Promise<number | null> {
  const a = await latestAttempt(q, learnerId, part, 'finished');
  return a ? Number((a.result as { placement: number }).placement) : null;
}

// ---------- Part D ----------

export const partDSchema = z.object({
  goal_areas: z.array(z.string()).max(2),
  main_goal: z.string(),
  earning_need: z.string(),
  mobility: z.string(),
  note: z.string().trim().max(500).optional().default(''),
  ms_taken: z.number().int().nonnegative().default(0),
});

export function validatePartD(ref: ReferenceData, body: z.infer<typeof partDSchema>) {
  const goals = new Set(ref.career_goals.goal_areas.filter((g) => g.status === 'active').map((g) => g.goal_id));
  if (new Set(body.goal_areas).size !== body.goal_areas.length || body.goal_areas.some((g) => !goals.has(g))) throw badRequest('Choose up to 2 different kinds of work', { field: 'goal_areas' });
  for (const field of ['main_goal', 'earning_need', 'mobility'] as const) {
    const item = ref.items.part_d.find((i) => i.field === field)!;
    if (!item.options!.some((o) => o.value === body[field])) throw badRequest('Choose one of the options', { field });
  }
}

export async function submitPartD(ctx: Ctx, learnerId: string, body: z.infer<typeof partDSchema>) {
  const { ref } = await ctx.versions.active();
  validatePartD(ref, body);
  const learner = await getLearner(ctx, learnerId);
  const changed = learner.goals !== null;
  const attempt = await openAttempt(ctx, learnerId, 'D');
  const goals = { goal_areas: body.goal_areas, main_goal: body.main_goal, earning_need: body.earning_need, mobility: body.mobility };
  await saveResponse(ctx, attempt.attempt_id, 'D', goals, body.ms_taken);
  await ctx.db.tx(async (q) => {
    await q.query('update learner set goals = $2::jsonb, note_enc = $3, updated_at = now() where learner_id = $1', [learnerId, JSON.stringify(goals), body.note ? ctx.cipher.encrypt(body.note) : null]);
    await q.query(`update assessment_attempt set status = 'finished', finished_at = now() where attempt_id = $1`, [attempt.attempt_id]);
  });
  return { changed };
}

// ---------- Item lists for the screens (no answer keys) ----------

export async function itemsForPart(ctx: Ctx, part: string) {
  const { ref } = await ctx.versions.active();
  if (part === 'A') return { items: resolvePartA(ref), states: ref.items.states };
  if (part === 'B') {
    return {
      response_sets: ref.items.response_sets,
      items: ref.items.part_b.filter((i) => i.status === 'active').sort((a, b) => a.order_no - b.order_no).map((i) => ({ item_id: i.item_id, text: i.text_en, stem: i.stem_en ?? null, response_set: i.response_set })),
    };
  }
  if (part === 'D') {
    return {
      items: ref.items.part_d.filter((i) => i.status === 'active'),
      goal_areas: ref.career_goals.goal_areas.filter((g) => g.status === 'active').map((g) => ({ goal_id: g.goal_id, name: g.name, definition: g.definition, example_roles: g.example_roles.slice(0, 3) })),
    };
  }
  throw badRequest('Part must be A, B or D');
}
