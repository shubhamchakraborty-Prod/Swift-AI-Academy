/**
 * Bridges stored answers and the pure engine.
 *   progress()      where the learner is in the journey, derived from data (so resume always works)
 *   buildInput()    collects Parts A-D into one EngineInput; throws 422 naming the first missing part (FR-9)
 *   computePersona / answerTiebreak   Step 7 and screen L10
 *   planPathway()   runs the engine, logs the run, stores the pathway; keeps locked terms (Steps 11, 14)
 *   acceptPathway / replayRun
 */
import type { Ctx } from '../context';
import { logEvent } from '../context';
import type { Queryable } from '../db/db';
import { newId } from '../crypto';
import { badRequest, HttpError } from '../errors';
import {
  diligenceFlag, extractFeatures, matchPersona, rankGoalAreas, runEngine, tiebreakSkillItem,
  type CourseRecord, type EngineConfig, type EngineInput, type EngineRun, type LearnerGoals, type LearnerProfile, type PathwayLength, type ReferenceData,
} from '../../engine';
import { getLearner, resolvePartA, type LearnerRow } from './learners';
import { makeLoc, type Lang } from '../i18n';
import { latestAttempt, partBScores, placement } from './assessment';

export type Step = 'about' | 'profile' | 'skill_ai' | 'skill_comm' | 'goals' | 'tiebreak' | 'plan' | 'results' | 'dashboard';

/** Where the learner is in the journey, derived from stored data so a dropped session resumes correctly. */
export async function progress(ctx: Ctx, learnerId: string) {
  const { ref, config } = await ctx.versions.active();
  const learner = await getLearner(ctx, learnerId);
  const partA = resolvePartA(ref);
  const nextA = partA.find((i) => !(i.field in learner.profile));
  const bOpen = await latestAttempt(ctx.db, learnerId, 'B', 'open');
  const bFinished = await latestAttempt(ctx.db, learnerId, 'B', 'finished');
  const ai = await placement(ctx.db, learnerId, 'C_AI');
  const comm = await placement(ctx.db, learnerId, 'C_COMM');
  const pathway = await currentPathway(ctx.db, learnerId);
  let step: Step;
  let pendingTiebreaks: string[] = [];
  if (nextA) step = 'about';
  else if (!bFinished || (bOpen && !pathway)) step = 'profile';
  else if (ai === null) step = 'skill_ai';
  else if (comm === null) step = 'skill_comm';
  else if (!learner.goals) step = 'goals';
  else {
    const input = await buildInput(ctx, learner, ref, config);
    pendingTiebreaks = matchPersona(extractFeatures(input, ref), ref, config, input.tiebreaks).tiebreak_pending;
    if (pendingTiebreaks.length && !pathway) step = 'tiebreak';
    else if (!pathway) step = 'plan';
    else if (pathway.status === 'proposed') step = 'results';
    else step = 'dashboard';
  }
  let answeredB = 0;
  if (bOpen) [{ count: answeredB }] = await ctx.db.query<{ count: number }>('select count(*)::int as count from learner_response where attempt_id = $1', [bOpen.attempt_id]);
  const bAnswers = bOpen ? await ctx.db.query<{ item_id: string; value: number }>('select item_id, value from learner_response where attempt_id = $1', [bOpen.attempt_id]) : [];
  return {
    learner_id: learnerId,
    first_name: learner.name_enc ? ctx.cipher.decrypt(learner.name_enc).split(' ')[0] : '',
    step,
    guardian_status: learner.guardian_status,
    next_part_a_item: nextA?.item_id ?? null,
    profile: learner.profile,
    goals: learner.goals,
    part_b: { open: Boolean(bOpen), answered: answeredB, answers: Object.fromEntries(bAnswers.map((r) => [r.item_id, Number(r.value)])), retake: Boolean(bOpen && bFinished) },
    pending_tiebreaks: pendingTiebreaks,
    pathway_id: pathway?.pathway_id ?? null,
    pathway_status: pathway?.status ?? null,
    min_age: config.consent.min_age,
  };
}

async function learnerCourses(q: Queryable, learnerId: string): Promise<CourseRecord[]> {
  const rows = await q.query<CourseRecord & { at: Date }>('select course_id, status, source, at from learner_course where learner_id = $1 order by at, course_id', [learnerId]);
  // A course assessment result outranks a self-report for the same course (trust order, Step 6).
  const byCourse = new Map<string, CourseRecord>();
  for (const r of rows) {
    const prev = byCourse.get(r.course_id);
    if (!prev || r.source === 'course_assessment') byCourse.set(r.course_id, { course_id: r.course_id, status: r.status, source: r.source });
  }
  return [...byCourse.values()];
}

/** Collects the four parts into one engine input. Throws 422 naming the first missing part (FR-9). */
export async function buildInput(ctx: Ctx, learner: LearnerRow, ref: ReferenceData, config: EngineConfig, opts: { length?: PathwayLength | null; locked?: EngineInput['locked_terms'] } = {}): Promise<EngineInput> {
  const id = learner.learner_id;
  const missing = (part: string) => new HttpError(422, 'incomplete', `Part ${part} of the assessment is not complete`, { missing_part: part });
  const p = learner.profile as Record<string, unknown>;
  if (resolvePartA(ref).some((i) => !(i.field in p))) throw missing('A');
  const partB = await partBScores(ctx.db, id);
  if (!partB) throw missing('B');
  const ai = await placement(ctx.db, id, 'C_AI');
  const comm = await placement(ctx.db, id, 'C_COMM');
  if (ai === null || comm === null) throw missing('C');
  if (!learner.goals) throw missing('D');

  // Diligence: answer times across the first sitting's parts, and their active time.
  const timing = await ctx.db.query<{ answered_at: Date; ms_taken: number }>(
    `select r.answered_at, r.ms_taken from learner_response r join assessment_attempt a on a.attempt_id = r.attempt_id
     where a.learner_id = $1 and a.part in ('A','B','C_AI','C_COMM','D')
       and a.attempt_id in (select distinct on (part) attempt_id from assessment_attempt where learner_id = $1 order by part, started_at)`,
    [id],
  );
  const diligence = diligenceFlag(timing.map((t) => new Date(t.answered_at).getTime()), timing.reduce((s, t) => s + t.ms_taken, 0) / 1000, config);
  const tb = await ctx.db.query<{ axis: string; value: number }>('select axis, value from tiebreak_answer where learner_id = $1', [id]);

  const profile: LearnerProfile = {
    age: learner.age,
    education_stage: String(p.education_stage),
    time_left: String(p.time_left),
    field_of_study: String(p.field_of_study),
    certificates: ((p.certificates as string[]) ?? []).filter((c) => c !== 'none'),
    work_experience: String(p.work_experience),
    role_level: String(p.role_level ?? 'none'),
    device: String(p.device),
    internet: String(p.internet),
    weekly_hours: String(p.weekly_hours),
  };
  return {
    profile,
    partB,
    ai_placement: ai,
    comm_placement: comm,
    diligence,
    goals: learner.goals as unknown as LearnerGoals,
    tiebreaks: Object.fromEntries(tb.map((t) => [t.axis, t.value])),
    courses: await learnerCourses(ctx.db, id),
    length_override: opts.length ?? null,
    locked_terms: opts.locked ?? [],
  };
}

// ---------- Persona and tie-breakers (Step 7, screen L10) ----------

export async function computePersona(ctx: Ctx, learnerId: string, lang: Lang = 'en') {
  const { ref, config } = await ctx.versions.active();
  const learner = await getLearner(ctx, learnerId);
  const input = await buildInput(ctx, learner, ref, config);
  const pr = matchPersona(extractFeatures(input, ref), ref, config, input.tiebreaks);
  const ax = Object.fromEntries(pr.axes.map((a) => [a.axis, a.score]));
  await ctx.db.query(
    `insert into persona_match (match_id, learner_id, config_version, reference_version, axis_direction, axis_start, axis_goal, axis_drive, persona_code, secondary_code, confidence, tiebreaks)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
    [newId('PM'), learnerId, config.version, ref.version, ax.direction, ax.starting_point, ax.goal_horizon, ax.learning_drive, pr.persona_code, pr.secondary_code, pr.confidence, JSON.stringify(input.tiebreaks)],
  );
  return { tiebreak_needed: pr.tiebreak_pending.map((axis) => tiebreakQuestion(ref, config, input, axis, lang)) };
}

function tiebreakQuestion(ref: ReferenceData, config: EngineConfig, input: EngineInput, axisId: string, lang: Lang = 'en') {
  const axis = ref.persona_rules.axes.find((a) => a.axis === axisId)!;
  const tb = axis.tiebreak;
  const loc = makeLoc(ref, lang);
  const h = loc.tiebreak(axisId);
  if (tb.type === 'goal_pick') {
    // Show the current top 3 goal areas; the preset follows the provisional (supportive) Direction pole.
    const pr = matchPersona(extractFeatures(input, ref), ref, config, input.tiebreaks);
    const persona = ref.personas.personas.find((p) => p.persona_code === pr.persona_code)!;
    const top = rankGoalAreas(ref, config, persona.preset, input.goals.goal_areas, input.partB, input.profile.field_of_study).slice(0, config.goal.top_n);
    return {
      axis: axisId, type: tb.type, question: h?.question ?? tb.question_en,
      options: [...top.map((g) => { const l = loc.goal(g.goal_id); return { value: g.goal_id, label: l.name, help: l.roles.slice(0, 3).join(', ') }; }), { value: 'none', label: h?.none ?? tb.none_label_en, help: null }],
    };
  }
  if (tb.type === 'skill_item') {
    const item = tiebreakSkillItem(ref.items.part_c, input.ai_placement, config)!;
    const hi = loc.item(item.item_id);
    return { axis: axisId, type: tb.type, question: h?.question ?? tb.question_en, item_text: hi?.text ?? item.text_en, item_id: item.item_id, options: item.options.map((o) => ({ value: o.value, label: hi?.options?.[o.value] ?? o.label_en, help: null })) };
  }
  return { axis: axisId, type: tb.type, question: h?.question ?? tb.question_en, options: tb.options.map((o) => ({ value: o.value, label: h?.options?.[o.value] ?? o.label_en, help: null })) };
}

export async function answerTiebreak(ctx: Ctx, learnerId: string, body: { axis: string; answer: string; ms_taken?: number }, lang: Lang = 'en') {
  const { ref, config } = await ctx.versions.active();
  const learner = await getLearner(ctx, learnerId);
  const input = await buildInput(ctx, learner, ref, config);
  const pr = matchPersona(extractFeatures(input, ref), ref, config, input.tiebreaks);
  if (!pr.tiebreak_pending.includes(body.axis)) throw new HttpError(409, 'not_needed', 'This question is not needed');
  const q = tiebreakQuestion(ref, config, input, body.axis);
  if (!q.options.some((o) => o.value === body.answer)) throw badRequest('Choose one of the options');
  const tb = ref.persona_rules.axes.find((a) => a.axis === body.axis)!.tiebreak;
  let value: number;
  if (tb.type === 'goal_pick') value = body.answer === 'none' ? tb.score_none : tb.score_pick;
  else if (tb.type === 'skill_item') {
    const item = ref.items.part_c.find((i) => i.item_id === (q as { item_id: string }).item_id)!;
    value = body.answer === item.answer ? tb.score_correct : tb.score_wrong;
  } else value = tb.options.find((o) => o.value === body.answer)!.score;
  await ctx.db.query(
    `insert into tiebreak_answer (learner_id, axis, answer, value) values ($1, $2, $3, $4) on conflict (learner_id, axis) do update set answer = excluded.answer, value = excluded.value, at = now()`,
    [learnerId, body.axis, body.answer, value],
  );
  return computePersona(ctx, learnerId, lang);
}

// ---------- Pathways (Steps 8 to 11, 13, 14) ----------

export interface PathwayRow {
  pathway_id: string;
  run_id: string;
  learner_id: string;
  persona_code: string;
  length_months: number;
  status: 'proposed' | 'accepted' | 'active' | 'completed' | 'replaced';
  banner: { message: string; at: string; changes: string[] } | null;
  created_at: Date;
  accepted_at: Date | null;
}
export interface TermRow {
  pathway_id: string;
  term_no: number;
  course_id: string;
  score: number;
  locked: boolean;
  status: 'planned' | 'active' | 'passed' | 'failed';
  starts_on: string | null;
  ends_on: string | null;
  reasons: Record<string, unknown>;
}

export async function currentPathway(q: Queryable, learnerId: string): Promise<PathwayRow | null> {
  const [row] = await q.query<PathwayRow>(`select * from pathway where learner_id = $1 and status <> 'replaced' order by created_at desc, pathway_id desc limit 1`, [learnerId]);
  return row ?? null;
}

export function assertResultsAllowed(learner: LearnerRow) {
  if (learner.guardian_status === 'pending') throw new HttpError(451, 'guardian_consent_missing', 'Your plan is ready to build once your parent or guardian gives consent.');
}

/** Runs the engine, logs the run and stores a pathway. Locked terms are carried over unchanged. */
export async function planPathway(ctx: Ctx, learnerId: string, opts: { length?: PathwayLength | null; trigger: string; actor: string; status?: PathwayRow['status'] }) {
  const { ref, config } = await ctx.versions.active();
  const learner = await getLearner(ctx, learnerId);
  assertResultsAllowed(learner);
  const prev = await currentPathway(ctx.db, learnerId);
  const prevTerms = prev ? await ctx.db.query<TermRow>('select * from pathway_term where pathway_id = $1 order by term_no', [prev.pathway_id]) : [];
  const finished = prev && prevTerms.length > 0 && prevTerms.every((t) => t.status === 'passed' || t.status === 'failed') && prev.status !== 'proposed';
  const locked = finished ? [] : prevTerms.filter((t) => t.locked);
  const length = (opts.length ?? (prev && !finished ? (prev.length_months as PathwayLength) : null)) as PathwayLength | null;
  if (length && locked.some((t) => t.term_no * config.term.months > length)) throw new HttpError(409, 'term_locked', 'A started term cannot be removed from the plan');

  const input = await buildInput(ctx, learner, ref, config, { length, locked: locked.map((t) => ({ term_no: t.term_no, course_id: t.course_id, outcome: t.status === 'failed' ? ('failed' as const) : null })) });
  const run = runEngine(input, ref, config);
  if (!run.ready) throw new HttpError(422, 'incomplete', 'Answer the quick questions first', { missing_part: 'tiebreak' });

  const runId = newId('RUN');
  const pathwayId = newId('PW');
  const keepStatus: PathwayRow['status'] = locked.length ? 'active' : finished ? 'proposed' : (opts.status ?? 'proposed');
  const changes = diffTerms(prevTerms.filter((t) => !t.locked), run);
  const banner = prev && prev.status !== 'proposed' && changes.length ? { message: finished ? 'Your next plan is ready' : 'Your plan was updated', at: ctx.now().toISOString(), changes } : null;

  await ctx.db.tx(async (q) => {
    await q.query(`insert into recommendation_run (run_id, learner_id, trigger, config_version, reference_version, inputs, output) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
      [runId, learnerId, opts.trigger, config.version, ref.version, JSON.stringify(input), JSON.stringify(run)]);
    if (prev) await q.query(`update pathway set status = $2 where pathway_id = $1`, [prev.pathway_id, finished ? 'completed' : 'replaced']);
    await q.query(`insert into pathway (pathway_id, run_id, learner_id, persona_code, length_months, status, explore_option, banner, accepted_at) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
      [pathwayId, runId, learnerId, run.persona.persona_code, run.pathway.length_months, keepStatus, run.explore_option?.course_id ?? null, banner ? JSON.stringify(banner) : null, keepStatus === 'proposed' ? null : prev?.accepted_at ?? ctx.now()]);
    for (const t of run.pathway.terms) {
      const old = locked.find((l) => l.term_no === t.term_no);
      await q.query(`insert into pathway_term (pathway_id, term_no, course_id, score, reasons, locked, status, starts_on, ends_on) values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)`,
        // A locked term keeps the reasons it was planned with; the engine never rewrites it.
        [pathwayId, t.term_no, t.course_id, old ? old.score : t.score, JSON.stringify(old ? old.reasons : t), Boolean(old), old?.status ?? 'planned', old?.starts_on ?? null, old?.ends_on ?? null]);
    }
    await q.query('delete from learner_skill_level where learner_id = $1', [learnerId]);
    for (const [skill, lv] of Object.entries(run.skill_levels)) {
      await q.query('insert into learner_skill_level (learner_id, skill_id, level, source) values ($1,$2,$3,$4)', [learnerId, skill, lv.level, lv.source]);
    }
    await logEvent(q, { id: newId('E'), learner_id: learnerId, type: 'pathway_planned', payload: { run_id: runId, pathway_id: pathwayId, trigger: opts.trigger, terms: run.pathway.terms.map((t) => t.course_id) }, actor: opts.actor });
  });
  return pathwayId;
}

function diffTerms(prevUnlocked: TermRow[], run: EngineRun): string[] {
  const out: string[] = [];
  for (const old of prevUnlocked) {
    const now = run.pathway.terms.find((t) => t.term_no === old.term_no);
    if (!now) out.push(`Months ${(old.term_no - 1) * 6 + 1} to ${old.term_no * 6}: ${old.course_id} is no longer in your plan`);
    else if (now.course_id !== old.course_id) out.push(`Months ${now.months.replace('-', ' to ')}: ${now.title} replaces ${old.course_id}`);
  }
  for (const t of run.pathway.terms) if (!prevUnlocked.some((o) => o.term_no === t.term_no) && !t.locked) out.push(`Months ${t.months.replace('-', ' to ')}: ${t.title} added`);
  return out;
}

export async function acceptPathway(ctx: Ctx, learnerId: string, pathwayId: string) {
  const current = await currentPathway(ctx.db, learnerId);
  if (!current || current.pathway_id !== pathwayId) throw new HttpError(409, 'stale', 'This plan has been replaced by a newer one');
  if (current.status !== 'proposed') return current;
  await ctx.db.tx(async (q) => {
    await q.query(`update pathway set status = 'accepted', accepted_at = now() where pathway_id = $1`, [pathwayId]);
    await logEvent(q, { id: newId('E'), learner_id: learnerId, type: 'pathway_accepted', payload: { pathway_id: pathwayId }, actor: 'learner' });
  });
  return { ...current, status: 'accepted' as const };
}

export async function runFor(ctx: Ctx, runId: string) {
  const [row] = await ctx.db.query<{ output: EngineRun; inputs: EngineInput; config_version: string; reference_version: string; created_at: Date; trigger: string }>('select * from recommendation_run where run_id = $1', [runId]);
  return row;
}

/** Replay a stored run with its stored versions (FR-26). */
export async function replayRun(ctx: Ctx, runId: string) {
  const row = await runFor(ctx, runId);
  if (!row) throw new HttpError(404, 'not_found', 'Run not found');
  const ref = await ctx.versions.reference(row.reference_version);
  const config = await ctx.versions.config(row.config_version);
  const replay = runEngine(row.inputs, ref, config);
  return { identical: canonical(replay) === canonical(row.output), run_id: runId };
}

/** JSON with sorted keys: jsonb does not keep key order, so compare canonical forms. */
export function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));
}
