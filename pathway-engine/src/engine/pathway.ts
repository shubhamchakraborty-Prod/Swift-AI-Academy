/**
 * Step 11 (PRD) / Section 14 (spec): builds the 6-month (1 course) or 12-month (2 courses) plan.
 * Term 2 is chosen after simulating term 1 as passed (its skills are raised and it counts as done).
 * Locked terms (already started) are kept exactly as they are; a failed locked term builds nothing, so the
 * next term can offer a retake or the next best course.
 */
import type { CourseRecord, EngineConfig, LearnerProfile, Persona, PathwayLength, Preset, ReferenceData } from './types';
import type { TargetGoal } from './goals';
import { skillNeeds, type SkillNeed } from './gaps';
import { scoreCourses, type CourseScore } from './courses';
import { raiseLevels, type SkillState } from './skillLevels';

export interface PlannedTerm {
  term_no: number;
  course_id: string;
  locked: boolean;
  score: CourseScore;
  state_before: SkillState;
  /** All course scores at this term, for the run log and mentor view. */
  all_scores: CourseScore[];
  needs: SkillNeed[];
}

export interface PathwayPlan {
  length_months: PathwayLength;
  length_source: 'persona' | 'learner';
  terms: PlannedTerm[];
  shortened: boolean;
  final_state: SkillState;
  done: Set<string>;
  /** Course scores at every term tried, including a term that found no course. */
  log: { term_no: number; scores: CourseScore[] }[];
}

export function defaultLength(persona: Persona): PathwayLength {
  return persona.default_length === 12 ? 12 : 6;
}

/** Step 11: one course per term; term 2 is chosen after simulating term 1 as passed. */
export function buildPathway(args: {
  ref: ReferenceData;
  config: EngineConfig;
  persona: Persona;
  preset: Preset;
  profile: LearnerProfile;
  placements: { ai: number; comm: number };
  courses: CourseRecord[];
  targets: TargetGoal[];
  state: SkillState;
  lengthOverride?: PathwayLength | null;
  lockedTerms?: { term_no: number; course_id: string; outcome?: 'failed' | null }[];
}): PathwayPlan {
  const { ref, config, preset, profile, placements, targets } = args;
  const length_months = args.lengthOverride ?? defaultLength(args.persona);
  const termCount = length_months / config.term.months;
  let state = args.state;
  const done = new Set(args.courses.filter((c) => c.status === 'passed').map((c) => c.course_id));
  const terms: PlannedTerm[] = [];
  const targetIds = targets.map((t) => t.goal_id);
  let shortened = false;
  const log: PathwayPlan['log'] = [];
  for (let t = 1; t <= termCount; t++) {
    const needs = skillNeeds(ref, config, targets, state);
    const scored = scoreCourses(ref, config, preset, profile, placements, done, needs, targetIds);
    log.push({ term_no: t, scores: scored });
    const locked = args.lockedTerms?.find((l) => l.term_no === t);
    const pick = locked ? scored.find((s) => s.course_id === locked.course_id) : scored.find((s) => s.recommended);
    if (!pick) {
      shortened = true;
      break;
    }
    terms.push({ term_no: t, course_id: pick.course_id, locked: Boolean(locked), score: pick, state_before: state, all_scores: scored, needs });
    // A failed locked term stays in the plan but builds nothing, so the next term can offer a retake.
    if (locked?.outcome === 'failed') continue;
    state = raiseLevels(state, ref, pick.course_id);
    done.add(pick.course_id);
  }
  return { length_months, length_source: args.lengthOverride ? 'learner' : 'persona', terms, shortened, final_state: state, done, log };
}

/** Explore-preset learners: best course for the 4th-ranked goal area, shown beside the pathway. */
export function exploreOption(args: {
  ref: ReferenceData;
  config: EngineConfig;
  preset: Preset;
  profile: LearnerProfile;
  placements: { ai: number; comm: number };
  courses: CourseRecord[];
  goal_id: string;
  state: SkillState;
  exclude: string[];
}): CourseScore | null {
  const { ref, config, preset, profile, placements } = args;
  const target = [{ goal_id: args.goal_id, weight: 1 }];
  const done = new Set(args.courses.filter((c) => c.status === 'passed').map((c) => c.course_id));
  const needs = skillNeeds(ref, config, target, args.state);
  const scored = scoreCourses(ref, config, preset, profile, placements, done, needs, [args.goal_id]);
  return scored.find((s) => s.recommended && !args.exclude.includes(s.course_id)) ?? null;
}
