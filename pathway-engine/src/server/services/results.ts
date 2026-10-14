/**
 * What the learner sees (screens L11-L16) and course platform events (Step 14).
 * learnerResults() deliberately leaves out habit scores, axis numbers and course scores (spec principle 12).
 */
import { z } from 'zod';
import type { Ctx } from '../context';
import { logEvent } from '../context';
import { newId } from '../crypto';
import { HttpError, notFound } from '../errors';
import type { EngineRun, TermOutput } from '../../engine';
import { getLearner } from './learners';
import { partBRetakeStatus } from './assessment';
import { assertResultsAllowed, currentPathway, planPathway, runFor, type PathwayRow, type TermRow } from './engineRunner';

/** Learner-facing results (screens L11 to L16). Habit scores and axis numbers stay with mentors. */
export async function learnerResults(ctx: Ctx, learnerId: string) {
  const learner = await getLearner(ctx, learnerId);
  assertResultsAllowed(learner);
  const pathway = await currentPathway(ctx.db, learnerId);
  if (!pathway) throw new HttpError(422, 'incomplete', 'Your plan has not been built yet', { missing_part: 'pathway' });
  const run = (await runFor(ctx, pathway.run_id)).output;
  const terms = await ctx.db.query<TermRow>('select * from pathway_term where pathway_id = $1 order by term_no', [pathway.pathway_id]);
  const { ref } = await ctx.versions.active();
  const courseRows = new Map(ref.courses.courses.map((c) => [c.course_id, c]));
  return {
    pathway_id: pathway.pathway_id,
    status: pathway.status,
    banner: pathway.banner,
    persona: {
      code: run.persona.persona_code,
      name: run.persona.name,
      one_line: run.persona.one_line,
      meaning: run.persona.meaning,
      support_mode: run.persona.support_mode,
      preset: run.persona.preset,
      poles: run.persona.axes.map((a) => ({ axis: a.name, pole: a.pole_name })),
      feedback: learner.persona_feedback,
    },
    interests: run.interests,
    part_b_used: run.part_b_used,
    part_b_retake: await partBRetakeStatus(ctx, learnerId),
    goals: run.goals.targets.map((t) => ({ goal_id: t.goal_id, name: t.name, definition: t.definition, example_roles: t.example_roles.slice(0, 3), reasons: t.reasons, chosen: t.asp > 0 })),
    chosen_goals: (learner.goals as { goal_areas: string[] } | null)?.goal_areas ?? [],
    goal_note: run.goal_note,
    top_gaps: run.top_gaps.map((g) => ({ skill_id: g.skill_id, name: g.name, definition: ref.skills.skills.find((s) => s.skill_id === g.skill_id)?.definition ?? '', current: g.current, needed: g.required })),
    pathway: {
      length_months: run.pathway.length_months,
      default_length: run.pathway.default_length,
      can_change_length: !terms.some((t) => t.locked) || (run.pathway.length_months === 6 && terms.length === 1),
      summary: run.pathway.summary,
      exploring_note: run.pathway.exploring_note,
      shortened: run.pathway.shortened,
      skills_gained: run.pathway.skills_gained,
      terms: terms.map((row) => {
        const t = row.reasons as unknown as TermOutput;
        const c = courseRows.get(row.course_id);
        const { score: _score, ...rest } = t;
        return { ...rest, locked: row.locked, status: row.status, starts_on: row.starts_on, ends_on: row.ends_on, modules: c?.modules.map((m) => m.title) ?? [] };
      }),
    },
    explore_option: run.explore_option ? { course_id: run.explore_option.course_id, title: run.explore_option.title, goal_name: run.explore_option.goal_name } : null,
    build_elsewhere: run.build_elsewhere,
    level_scale: ref.skills.level_scale ?? [],
    templates: { build_elsewhere: ref.templates.templates.build_elsewhere, no_course: ref.templates.templates.no_course, shorter_pathway: ref.templates.templates.shorter_pathway },
  };
}

/** L15: public course detail from the active catalogue. */
export async function courseDetail(ctx: Ctx, courseId: string) {
  const { ref } = await ctx.versions.active();
  const c = ref.courses.courses.find((x) => x.course_id === courseId && x.status === 'active');
  if (!c) throw notFound('Course not found');
  const skills = new Map(ref.skills.skills.map((s) => [s.skill_id, s]));
  const unlocks = ref.courses.courses.filter((x) => x.status === 'active' && x.prerequisites.hard.includes(c.course_id)).map((x) => ({ course_id: x.course_id, title: x.title }));
  const series = ref.courses.series.find((s) => s.series_id === c.series_id);
  const nsqf = c.nsqf_level.min === c.nsqf_level.max ? `${c.nsqf_level.max}` : `${c.nsqf_level.min} to ${c.nsqf_level.max}`;
  return {
    course_id: c.course_id,
    title: c.title,
    series: series?.name ?? c.series_id,
    nsqf_label: `Designed against NSQF Level ${nsqf} descriptors`,
    hours: c.hours,
    terminal_outcome: c.terminal_outcome,
    pitched_at: c.pitched_at ?? null,
    modules: c.modules.map((m) => m.title),
    assessment_gate: c.assessment_gate ?? null,
    skills: c.skills.map((s) => ({ skill_id: s.skill_id, name: skills.get(s.skill_id)?.name, definition: skills.get(s.skill_id)?.definition, level_out: s.level_out, primary: s.primary })),
    prerequisites: {
      hard: c.prerequisites.hard.map((id) => ({ course_id: id, title: ref.courses.courses.find((x) => x.course_id === id)?.title })),
      soft: c.prerequisites.soft.map((id) => ({ course_id: id, title: ref.courses.courses.find((x) => x.course_id === id)?.title })),
      entry_level: c.entry_level,
    },
    unlocks,
  };
}

// ---------- Course platform events (Step 14) ----------

export const eventSchema = z.object({
  type: z.enum(['course_started', 'course_passed', 'course_failed', 'term_ended']),
  course_id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function handleEvent(ctx: Ctx, learnerId: string, body: z.infer<typeof eventSchema>) {
  const { config } = await ctx.versions.active();
  await getLearner(ctx, learnerId);
  const pathway = await currentPathway(ctx.db, learnerId);
  if (!pathway || pathway.status === 'proposed') throw new HttpError(409, 'no_accepted_plan', 'The learner has no accepted plan');
  const terms = await ctx.db.query<TermRow>('select * from pathway_term where pathway_id = $1 order by term_no', [pathway.pathway_id]);
  const term = terms.find((t) => t.course_id === body.course_id);
  const date = body.date ?? ctx.now().toISOString().slice(0, 10);
  await logEvent(ctx.db, { id: newId('E'), learner_id: learnerId, type: body.type, payload: body, actor: 'course_platform' });

  if (body.type === 'course_started') {
    if (!term) throw new HttpError(409, 'not_in_plan', 'This course is not in the learner\'s plan');
    if (term.locked) return { pathway_id: pathway.pathway_id, replanned: false };
    const ends = new Date(`${date}T00:00:00Z`);
    ends.setUTCDate(ends.getUTCDate() + config.term.weeks * 7);
    await ctx.db.query(`update pathway_term set locked = true, status = 'active', starts_on = $3, ends_on = $4 where pathway_id = $1 and term_no = $2`, [pathway.pathway_id, term.term_no, date, ends.toISOString().slice(0, 10)]);
    await ctx.db.query(`update pathway set status = 'active' where pathway_id = $1`, [pathway.pathway_id]);
    return { pathway_id: pathway.pathway_id, replanned: false };
  }
  if (body.type === 'course_passed' || body.type === 'course_failed') {
    const status = body.type === 'course_passed' ? 'passed' : 'failed';
    await ctx.db.query(
      `insert into learner_course (learner_id, course_id, status, source) values ($1, $2, $3, 'course_assessment')
       on conflict (learner_id, course_id, source) do update set status = excluded.status, at = now()`,
      [learnerId, body.course_id, status],
    );
    if (term) await ctx.db.query(`update pathway_term set status = $3, locked = true where pathway_id = $1 and term_no = $2`, [pathway.pathway_id, term.term_no, status]);
    const id = await planPathway(ctx, learnerId, { trigger: body.type, actor: 'course_platform', status: 'accepted' });
    return { pathway_id: id, replanned: true };
  }
  // term_ended: logged; the end-of-term re-check is offered to the learner on the dashboard.
  return { pathway_id: pathway.pathway_id, replanned: false };
}

export type { PathwayRow, EngineRun };
