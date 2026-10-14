/**
 * What the learner sees (screens L11-L16) and course platform events (Step 14).
 * learnerResults() deliberately leaves out habit scores, axis numbers and course scores (spec principle 12).
 */
import { z } from 'zod';
import type { Ctx } from '../context';
import { logEvent } from '../context';
import { newId } from '../crypto';
import { HttpError, notFound } from '../errors';
import type { EngineRun, SkillGained, TermOutput } from '../../engine';
import { makeLoc, type Lang } from '../i18n';
import { getLearner } from './learners';
import { partBRetakeStatus } from './assessment';
import { assertResultsAllowed, currentPathway, planPathway, runFor, type PathwayRow, type TermRow } from './engineRunner';

/** Learner-facing results (screens L11 to L16), rendered in the learner's language from the stored run.
 *  Habit scores, axis numbers and course scores are deliberately left out (spec principle 12). */
export async function learnerResults(ctx: Ctx, learnerId: string, lang: Lang = 'en') {
  const learner = await getLearner(ctx, learnerId);
  assertResultsAllowed(learner);
  const pathway = await currentPathway(ctx.db, learnerId);
  if (!pathway) throw new HttpError(422, 'incomplete', 'Your plan has not been built yet', { missing_part: 'pathway' });
  const run = (await runFor(ctx, pathway.run_id)).output;
  const terms = await ctx.db.query<TermRow>('select * from pathway_term where pathway_id = $1 order by term_no', [pathway.pathway_id]);
  const { ref } = await ctx.versions.active();
  const loc = makeLoc(ref, lang);
  const courseRows = new Map(ref.courses.courses.map((c) => [c.course_id, c]));
  const roleText = (r: string) => (lang === 'en' ? r.toLowerCase() : r);

  const skillsGained = (list: SkillGained[]) => list.map((g) => ({
    ...g, ...loc.skill(g.skill_id),
    helps: g.helps.map((h) => { const goal = loc.goal(h.goal_id); return { ...h, goal_name: goal.name, roles: goal.roles.slice(0, 2) }; }),
  }));

  const termView = (row: TermRow) => {
    const t = row.reasons as unknown as TermOutput;
    const c = loc.course(t.course_id);
    const goal = loc.goal(t.text_vars?.goal_id ?? t.goal_areas[0] ?? run.goals.targets[0].goal_id);
    const sentence = loc.render('course_reason', { course: c.title, outcome: c.outcome, goal_area: goal.name, role1: roleText(goal.roles[0]), role2: roleText(goal.roles[1]) });
    const warnings = (t.text_vars?.warnings ?? []).map((w) => (w.code === 'soft_prereq'
      ? loc.render('warning_soft_prereq', { course: loc.course(w.course_id!).title })
      : loc.render('warning_heavy_load', { weekly: w.weekly! })));
    return {
      term_no: t.term_no, months: t.months, course_id: t.course_id, title: c.title,
      nsqf_label: loc.nsqf(courseRows.get(t.course_id)!), hours_total: t.hours_total,
      sentence,
      reason_skills: t.reason_skills.map((r) => ({ ...r, name: loc.skill(r.skill_id).name })),
      skills_gained: skillsGained(t.skills_gained),
      goal_areas: t.goal_areas,
      unlocks: t.unlocks ? { course_id: t.unlocks.course_id, title: loc.course(t.unlocks.course_id).title } : null,
      warnings, modules: c.modules,
      locked: row.locked, status: row.status, starts_on: row.starts_on, ends_on: row.ends_on,
    };
  };

  const persona = ref.personas.personas.find((p) => p.persona_code === run.persona.persona_code)!;
  const lengthKey = persona.default_length === '6_then_extend' ? '6_then_extend' : String(persona.default_length);
  const meaning = loc.render('persona_meaning', { length_phrase: loc.template(`length_phrase_${lengthKey}`), support_phrase: loc.template(`support_phrase_${persona.support_mode}`) });
  const sv = run.pathway.summary_vars;
  const summary = sv ? loc.render('pathway_summary', { months: sv.months, skills: loc.list(sv.skill_ids.map((id) => loc.inSentence(loc.skill(id).name))), goal_area: loc.goal(sv.goal_id).name }) : null;
  const gn = run.goal_note_vars;
  const levelScale = ref.skills.level_scale ?? [];

  return {
    pathway_id: pathway.pathway_id,
    status: pathway.status,
    banner: pathway.banner,
    persona: {
      code: run.persona.persona_code,
      ...loc.persona(run.persona.persona_code),
      meaning,
      support_mode: run.persona.support_mode,
      preset: run.persona.preset,
      poles: run.persona.axes.map((a) => ({ axis: loc.axis(a.axis, a.name), pole: loc.pole(a.pole_letter, a.pole_name) })),
      feedback: learner.persona_feedback,
    },
    interests: run.interests ? run.interests.map((i) => ({ ...i, name: loc.orientation(i.orientation) })) : null,
    part_b_used: run.part_b_used,
    part_b_retake: await partBRetakeStatus(ctx, learnerId),
    goals: run.goals.targets.map((t) => { const g = loc.goal(t.goal_id); return { goal_id: t.goal_id, name: g.name, definition: g.definition, example_roles: g.roles.slice(0, 3), reasons: t.reasons, chosen: t.asp > 0 }; }),
    chosen_goals: (learner.goals as { goal_areas: string[] } | null)?.goal_areas ?? [],
    goal_note: gn ? loc.render('goal_interest_differ', { chosen_goal: loc.goal(gn.chosen_goal).name, orientation: loc.orientation(gn.orientation), other_goal: loc.goal(gn.other_goal).name }) : null,
    top_gaps: run.top_gaps.map((g) => ({ ...loc.skill(g.skill_id), current: g.current, needed: g.required })),
    pathway: {
      length_months: run.pathway.length_months,
      default_length: run.pathway.default_length,
      can_change_length: !terms.some((t) => t.locked) || (run.pathway.length_months === 6 && terms.length === 1),
      summary,
      exploring_note: run.pathway.exploring_note ? loc.render('exploring') : null,
      shortened: run.pathway.shortened,
      skills_gained: skillsGained(run.pathway.skills_gained),
      terms: terms.map(termView),
    },
    explore_option: run.explore_option ? { course_id: run.explore_option.course_id, title: loc.course(run.explore_option.course_id).title, goal_name: loc.goal(run.explore_option.goal_id).name } : null,
    build_elsewhere: run.build_elsewhere.map((b) => ({ ...b, name: loc.skill(b.skill_id).name })),
    level_scale: levelScale.map((l) => ({ level: l.level, descriptor: loc.level(l.level, l.descriptor) })),
    templates: { build_elsewhere: loc.template('build_elsewhere'), no_course: loc.template('no_course'), shorter_pathway: loc.template('shorter_pathway') },
  };
}

/** L15: public course detail from the active catalogue, in the learner's language. */
export async function courseDetail(ctx: Ctx, courseId: string, lang: Lang = 'en') {
  const { ref } = await ctx.versions.active();
  const loc = makeLoc(ref, lang);
  const c = ref.courses.courses.find((x) => x.course_id === courseId && x.status === 'active');
  if (!c) throw notFound('Course not found');
  const lc = loc.course(c.course_id);
  return {
    course_id: c.course_id,
    title: lc.title,
    series: loc.series(c.series_id),
    nsqf_label: loc.nsqf(c),
    hours: c.hours,
    terminal_outcome: lc.outcome,
    pitched_at: lc.pitched_at,
    modules: lc.modules,
    assessment_gate: lc.gate,
    skills: c.skills.map((s) => ({ ...loc.skill(s.skill_id), level_out: s.level_out, primary: s.primary })),
    prerequisites: {
      hard: c.prerequisites.hard.map((id) => ({ course_id: id, title: loc.course(id).title })),
      soft: c.prerequisites.soft.map((id) => ({ course_id: id, title: loc.course(id).title })),
      entry_level: c.entry_level,
    },
    unlocks: ref.courses.courses.filter((x) => x.status === 'active' && x.prerequisites.hard.includes(c.course_id)).map((x) => ({ course_id: x.course_id, title: loc.course(x.course_id).title })),
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
