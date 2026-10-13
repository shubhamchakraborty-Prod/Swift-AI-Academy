import type { EngineConfig, EngineInput, ReferenceData } from './types';
import { extractFeatures } from './features';
import { matchPersona, type PersonaResult } from './persona';
import { rankGoalAreas, topGoals, type GoalScore, type TargetGoal } from './goals';
import { skillNeeds, type SkillNeed } from './gaps';
import { startingSkillLevels, type SkillState } from './skillLevels';
import { buildPathway, exploreOption } from './pathway';
import type { CourseScore } from './courses';
import { joinList, render } from './text';

export interface SkillHelp {
  goal_id: string;
  goal_name: string;
  roles: string[];
  in_your_plan: boolean; // one of the learner's top 3 goal areas
}

export interface SkillGained {
  skill_id: string;
  name: string;
  definition: string;
  from: number;
  to: number;
  helps: SkillHelp[];
}

export interface TermOutput {
  term_no: number;
  months: string;
  course_id: string;
  title: string;
  nsqf_label: string;
  hours_total: number | null;
  locked: boolean;
  score: number;
  sentence: string;
  /** Top skills by D x gain, the spec's "reasons.skills". */
  reason_skills: { skill_id: string; name: string; from: number; to: number }[];
  /** Every skill this course raises for this learner, with how it helps. */
  skills_gained: SkillGained[];
  goal_areas: string[];
  unlocks: { course_id: string; title: string } | null;
  warnings: string[];
}

export interface EngineRun {
  versions: { config: string; reference: string };
  ready: boolean; // false while tie-breakers are pending
  persona: PersonaResult & { name: string; one_line: string; preset: string; support_mode: string; meaning: string; secondary_name: string };
  interests: { orientation: string; name: string; score: number }[] | null;
  part_b_used: boolean;
  goals: { ranked: GoalScore[]; targets: (TargetGoal & { name: string; definition: string; example_roles: string[] })[] };
  goal_note: string | null;
  skill_levels: SkillState;
  needs: SkillNeed[];
  top_gaps: (SkillNeed & { name: string })[];
  pathway: {
    length_months: number;
    length_source: string;
    default_length: string | number;
    terms: TermOutput[];
    shortened: boolean;
    summary: string | null;
    exploring_note: string | null;
    skills_gained: SkillGained[];
  };
  explore_option: { course_id: string; title: string; goal_id: string; goal_name: string; score: number } | null;
  build_elsewhere: { skill_id: string; name: string; needed: number; after_plan: number; catalogue_max: number }[];
  course_scores_by_term: { term_no: number; scores: CourseScore[] }[];
}

const fmtLevel = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

export function runEngine(input: EngineInput, ref: ReferenceData, config: EngineConfig): EngineRun {
  const T = ref.templates;
  const skillById = new Map(ref.skills.skills.map((s) => [s.skill_id, s]));
  const goalById = new Map(ref.career_goals.goal_areas.map((g) => [g.goal_id, g]));
  const courseById = new Map(ref.courses.courses.map((c) => [c.course_id, c]));
  const orientationName = new Map(ref.career_goals.orientations.map((o) => [o.id, o.name]));

  // Step 7: persona
  const features = extractFeatures(input, ref);
  const pr = matchPersona(features, ref, config, input.tiebreaks);
  const persona = ref.personas.personas.find((p) => p.persona_code === pr.persona_code)!;
  const secondary = ref.personas.personas.find((p) => p.persona_code === pr.secondary_code)!;
  const preset = persona.preset;
  const partBUsable = Boolean(input.partB && !input.partB.flagged);

  // Step 8: goal areas
  const ranked = rankGoalAreas(ref, config, preset, input.goals.goal_areas, input.partB, input.profile.field_of_study);
  const targets = topGoals(ranked, config, preset, partBUsable);

  // Steps 6 and 9: levels and gaps
  const placements = { ai: input.ai_placement, comm: input.comm_placement };
  const state = startingSkillLevels(ref, config, input.profile, input.ai_placement, input.comm_placement, input.courses);
  const needs = skillNeeds(ref, config, targets, state);

  // Steps 10 and 11: course scores and pathway
  const plan = buildPathway({ ref, config, persona, preset, profile: input.profile, placements, courses: input.courses, targets, state, lengthOverride: input.length_override, lockedTerms: input.locked_terms });

  const helpsFor = (skillId: string): SkillHelp[] => {
    const targetIds = targets.map((t) => t.goal_id);
    const listing = ref.career_goals.goal_skills.filter((gs) => gs.skill_id === skillId).map((gs) => gs.goal_id);
    const inPlan = targetIds.filter((g) => listing.includes(g));
    const others = listing.filter((g) => !targetIds.includes(g)).sort();
    return [...inPlan.map((g) => ({ g, mine: true })), ...others.slice(0, 2).map((g) => ({ g, mine: false }))].map(({ g, mine }) => {
      const goal = goalById.get(g)!;
      return { goal_id: g, goal_name: goal.name, roles: goal.example_roles.slice(0, 2), in_your_plan: mine };
    });
  };
  const gainedBetween = (before: SkillState, after: SkillState): SkillGained[] =>
    Object.keys(after)
      .filter((id) => after[id].level > before[id].level)
      .map((id) => {
        const s = skillById.get(id)!;
        return { skill_id: id, name: s.name, definition: s.definition, from: before[id].level, to: after[id].level, helps: helpsFor(id) };
      })
      .sort((a, b) => {
        const da = needs.find((n) => n.skill_id === a.skill_id)?.demand ?? 0;
        const db = needs.find((n) => n.skill_id === b.skill_id)?.demand ?? 0;
        return db - da || a.skill_id.localeCompare(b.skill_id);
      });

  const terms: TermOutput[] = plan.terms.map((t, i) => {
    const course = courseById.get(t.course_id)!;
    const s = t.score;
    const after = plan.terms[i + 1]?.state_before ?? plan.final_state;
    const servedGoal = targets.find((g) => s.goal_ids.includes(g.goal_id)) ?? targets[0];
    const goal = goalById.get(servedGoal.goal_id)!;
    const sentence = render(T, 'course_reason', {
      course: course.title,
      outcome: course.terminal_outcome,
      goal_area: goal.name,
      role1: goal.example_roles[0].toLowerCase(),
      role2: goal.example_roles[1].toLowerCase(),
    });
    const warnings = s.warnings.map((w) =>
      w.code === 'soft_prereq'
        ? render(T, 'warning_soft_prereq', { course: courseById.get(w.course_id!)?.title ?? w.course_id! })
        : render(T, 'warning_heavy_load', { weekly: fmtLevel(w.weekly_hours!) }),
    );
    const nsqf = course.nsqf_level.min === course.nsqf_level.max ? fmtLevel(course.nsqf_level.max) : `${fmtLevel(course.nsqf_level.min)} to ${fmtLevel(course.nsqf_level.max)}`;
    const startMonth = (t.term_no - 1) * config.term.months + 1;
    return {
      term_no: t.term_no,
      months: `${startMonth}-${startMonth + config.term.months - 1}`,
      course_id: course.course_id,
      title: course.title,
      nsqf_label: `Designed against NSQF Level ${nsqf} descriptors`,
      hours_total: course.hours?.total ?? null,
      locked: t.locked,
      score: s.score,
      sentence,
      reason_skills: s.gains.slice(0, config.course.top_reason_skills).map((g) => ({ skill_id: g.skill_id, name: skillById.get(g.skill_id)!.name, from: g.from, to: g.to })),
      skills_gained: gainedBetween(t.state_before, after),
      goal_areas: s.goal_ids,
      unlocks: s.unlocks ? { course_id: s.unlocks, title: courseById.get(s.unlocks)!.title } : null,
      warnings,
    };
  });

  // Pathway summary sentence: top 3 skills across the plan, toward the first goal area.
  const planGains = plan.terms.flatMap((t) => t.score.gains).sort((a, b) => b.weighted - a.weighted);
  const summarySkills = [...new Set(planGains.map((g) => g.skill_id))].slice(0, 3).map((id) => skillById.get(id)!.name.toLowerCase());
  const summary = terms.length && summarySkills.length
    ? render(T, 'pathway_summary', { months: plan.terms.length * config.term.months, skills: joinList(summarySkills), goal_area: goalById.get(targets[0].goal_id)!.name })
    : null;
  const covered = new Set(plan.terms.flatMap((t) => t.score.goal_ids));
  const exploring_note = preset === 'explore' && targets.every((t) => covered.has(t.goal_id)) && terms.length ? render(T, 'exploring') : null;

  // Goal and interest differ (principle 7: respect the learner's goal, show both).
  let goal_note: string | null = null;
  if (partBUsable && input.goals.goal_areas.length) {
    const chosen = goalById.get(input.goals.goal_areas[0])!;
    const top = input.partB!.top_orientation;
    const other = targets.find((t) => t.goal_id !== chosen.goal_id && goalById.get(t.goal_id)!.primary_orientation === top);
    if (chosen.primary_orientation !== top && other) {
      goal_note = render(T, 'goal_interest_differ', { chosen_goal: chosen.name, orientation: orientationName.get(top)!, other_goal: goalById.get(other.goal_id)!.name });
    }
  }

  // Explore option: best course for the 4th-ranked goal area.
  let explore: EngineRun['explore_option'] = null;
  if (preset === 'explore' && ranked[config.goal.top_n]) {
    const g = ranked[config.goal.top_n];
    const opt = exploreOption({ ref, config, preset, profile: input.profile, placements, courses: input.courses, goal_id: g.goal_id, state, exclude: plan.terms.map((t) => t.course_id) });
    if (opt) explore = { course_id: opt.course_id, title: courseById.get(opt.course_id)!.title, goal_id: g.goal_id, goal_name: goalById.get(g.goal_id)!.name, score: opt.score };
  }

  // Build elsewhere: remaining gaps the active catalogue cannot close.
  const finalNeeds = skillNeeds(ref, config, targets, plan.final_state);
  const catalogueMax = (skillId: string) =>
    Math.max(0, ...ref.courses.courses.filter((c) => c.status === 'active').flatMap((c) => c.skills.filter((s) => s.skill_id === skillId).map((s) => s.level_out)));
  const build_elsewhere = finalNeeds
    .filter((n) => n.gap > 0 && catalogueMax(n.skill_id) < n.required)
    .sort((a, b) => b.demand - a.demand || a.skill_id.localeCompare(b.skill_id))
    .map((n) => ({ skill_id: n.skill_id, name: skillById.get(n.skill_id)!.name, needed: n.required, after_plan: n.current, catalogue_max: catalogueMax(n.skill_id) }));

  const lengthKey = persona.default_length === '6_then_extend' ? '6_then_extend' : String(persona.default_length);
  const meaning = render(T, 'persona_meaning', { length_phrase: T.templates[`length_phrase_${lengthKey}`], support_phrase: T.templates[`support_phrase_${persona.support_mode}`] });

  return {
    versions: { config: config.version, reference: ref.version },
    ready: pr.tiebreak_pending.length === 0,
    persona: { ...pr, name: persona.name, one_line: persona.one_line, preset, support_mode: persona.support_mode, meaning, secondary_name: secondary.name },
    interests: partBUsable
      ? input.partB!.interest_rank.map((o) => ({ orientation: o, name: orientationName.get(o)!, score: input.partB!.interests[o] }))
      : null,
    part_b_used: partBUsable,
    goals: {
      ranked,
      targets: targets.map((t) => {
        const g = goalById.get(t.goal_id)!;
        return { ...t, name: g.name, definition: g.definition, example_roles: g.example_roles };
      }),
    },
    goal_note,
    skill_levels: state,
    needs,
    top_gaps: needs.filter((n) => n.gap > 0).slice(0, config.results.top_gaps).map((n) => ({ ...n, name: skillById.get(n.skill_id)!.name })),
    pathway: {
      length_months: plan.length_months,
      length_source: plan.length_source,
      default_length: persona.default_length,
      terms,
      shortened: plan.shortened,
      summary,
      exploring_note,
      skills_gained: plan.terms.length ? gainedBetween(state, plan.final_state) : [],
    },
    explore_option: explore,
    build_elsewhere,
    course_scores_by_term: plan.log,
  };
}
