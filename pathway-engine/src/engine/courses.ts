/**
 * Step 10 (PRD) / Section 13 Step 4 (spec): eligibility and the course score.
 * Score = Psoft * (wA*A + wU*U + wB*B + wF*F)
 *   A  alignment: weighted useful gain, divided by the best eligible course (best = 1.0)
 *   U  unlock value: how strong the next course this one opens would be
 *   B  breadth: share of the 3 target goal areas the course helps
 *   F  format fit: weekly load (hours / 26) against the learner's available hours
 * A course is recommended only if it is eligible, A > 0, score >= min_score, and (TC-5) the learner's placement
 * does not already reach its output level. Ties: higher A, lower entry level, then course id.
 * The engine never reads a course name: a new course in courses.json is scored with no code change.
 */
import type { Course, EligibilityRule, EngineConfig, LearnerProfile, Preset, ReferenceData } from './types';
import type { SkillNeed } from './gaps';
import { cmpDesc } from './util';

export interface Ineligibility {
  code: 'completed' | 'prerequisite' | 'rule' | 'not_active';
  detail: string;
  /** For prerequisite failures: the courses that would open this one. */
  needs?: string[];
}

export interface EligibilityContext {
  profile: LearnerProfile;
  placements: { ai: number; comm: number };
  done: Set<string>;
}

const fieldValue = (profile: LearnerProfile, field: string): unknown => (profile as unknown as Record<string, unknown>)[field];

function ruleHolds(rule: EligibilityRule, profile: LearnerProfile): boolean {
  const v = fieldValue(profile, rule.field);
  switch (rule.op) {
    case 'in': return Array.isArray(rule.value) && rule.value.map(String).includes(String(v));
    case '==': return String(v) === String(rule.value);
    case '>=': return Number(v) >= Number(rule.value);
    case '<=': return Number(v) <= Number(rule.value);
  }
}

/** Entry rule: hard prerequisites completed OR series placement at or above entry level; other rules; not already done. */
export function checkEligibility(course: Course, ctx: EligibilityContext): Ineligibility[] {
  const out: Ineligibility[] = [];
  if (course.status !== 'active') out.push({ code: 'not_active', detail: 'Course is not active' });
  if (ctx.done.has(course.course_id)) out.push({ code: 'completed', detail: 'Already completed' });
  const placement = ctx.placements[course.entry_ladder];
  const hard = course.prerequisites.hard;
  const prereqsDone = hard.length > 0 && hard.every((p) => ctx.done.has(p));
  if (!(placement >= course.entry_level || prereqsDone)) {
    out.push({ code: 'prerequisite', detail: `Needs level ${course.entry_level} or ${hard.join(', ') || 'a higher starting level'}`, needs: hard.filter((p) => !ctx.done.has(p)) });
  }
  if (course.eligibility.length && !course.eligibility.some((group) => group.every((r) => ruleHolds(r, ctx.profile)))) {
    out.push({ code: 'rule', detail: course.eligibility.map((g) => g.map((r) => `${r.field} ${r.op} ${JSON.stringify(r.value)}`).join(' and ')).join(' or ') });
  }
  return out;
}

export interface SkillGain { skill_id: string; from: number; to: number; gain: number; weighted: number }

export interface CourseScore {
  course_id: string;
  eligible: boolean;
  ineligible: Ineligibility[];
  a_raw: number;
  A: number;
  U: number;
  B: number;
  F: number;
  p_soft: number;
  score: number;
  recommended: boolean;
  /** The learner's placement on this course's ladder already reaches its output level. */
  below_placement: boolean;
  gains: SkillGain[]; // skills with demand and gain > 0, by D x gain
  goal_ids: string[]; // target goal areas this course helps (breadth)
  unlocks: string | null;
  warnings: { code: 'soft_prereq' | 'heavy_load'; course_id?: string; weekly_hours?: number }[];
}

/** Gain counts only useful levels: up to the required level, above the current level. */
function gainsFor(course: Course, needs: Map<string, SkillNeed>): SkillGain[] {
  const gains: SkillGain[] = [];
  for (const cs of course.skills) {
    const n = needs.get(cs.skill_id);
    if (!n) continue;
    const gain = Math.max(0, Math.min(cs.level_out, n.required) - n.current);
    if (gain > 0) gains.push({ skill_id: cs.skill_id, from: n.current, to: cs.level_out, gain, weighted: n.demand * gain });
  }
  return gains.sort((a, b) => cmpDesc(a.weighted, b.weighted) || a.skill_id.localeCompare(b.skill_id));
}

const aRaw = (gains: SkillGain[]) => gains.reduce((s, g) => s + g.weighted, 0);

export function formatFit(course: Course, profile: LearnerProfile, config: EngineConfig, weeks: number): { F: number; weekly: number } {
  if (!course.hours) return { F: 0, weekly: Infinity };
  const ff = config.course.format_fit;
  const weekly = course.hours.total / weeks;
  const available = config.course.available_hours[profile.weekly_hours] ?? 0;
  let F = weekly <= available ? 1 : weekly <= ff.partial_ratio * available ? ff.partial_value : 0;
  if (profile.internet === 'mostly_offline' && course.delivery.offline_ok !== true) F *= ff.offline_factor;
  return { F, weekly };
}

/** Step 10: score every course for the current simulated state. */
export function scoreCourses(
  ref: ReferenceData,
  config: EngineConfig,
  preset: Preset,
  profile: LearnerProfile,
  placements: { ai: number; comm: number },
  done: Set<string>,
  needs: SkillNeed[],
  targets: string[],
): CourseScore[] {
  const needMap = new Map(needs.map((n) => [n.skill_id, n]));
  const active = ref.courses.courses.filter((c) => c.status === 'active');
  const ctx: EligibilityContext = { profile, placements, done };
  const rows = active.map((course) => {
    const ineligible = checkEligibility(course, ctx);
    const gains = gainsFor(course, needMap);
    return { course, ineligible, eligible: ineligible.length === 0, gains, a_raw: aRaw(gains) };
  });
  const maxEligible = Math.max(0, ...rows.filter((r) => r.eligible).map((r) => r.a_raw));
  const rawById = new Map(rows.map((r) => [r.course.course_id, r.a_raw]));
  const w = config.course.weights[preset];

  const scored: CourseScore[] = rows.map(({ course, ineligible, eligible, gains, a_raw }) => {
    const A = maxEligible > 0 ? a_raw / maxEligible : 0;
    // Unlock value: best raw alignment among courses that need this one as a hard prerequisite.
    const unlocked = active.filter((c) => c.prerequisites.hard.includes(course.course_id)).sort((a, b) => a.course_id.localeCompare(b.course_id));
    let bestUnlock: string | null = null;
    let bestUnlockRaw = 0;
    for (const c of unlocked) {
      const r = rawById.get(c.course_id) ?? 0;
      if (r > bestUnlockRaw + 1e-12) { bestUnlock = c.course_id; bestUnlockRaw = r; }
    }
    const U = maxEligible > 0 && bestUnlockRaw > 0 ? config.course.unlock_factor * Math.min(1, bestUnlockRaw / maxEligible) : 0;
    const helped = targets.filter((g) => gains.some((x) => needMap.get(x.skill_id)!.goal_ids.includes(g)));
    const B = targets.length ? helped.length / targets.length : 0;
    const { F, weekly } = formatFit(course, profile, config, config.term.weeks);
    const softMissing = course.prerequisites.soft.filter((p) => !done.has(p));
    const p_soft = softMissing.length ? config.course.soft_prereq_penalty : 1;
    const score = eligible ? p_soft * (w.A * A + w.U * U + w.B * B + w.F * F) : 0;
    const below_placement = Boolean(config.course.drop_at_or_below_placement) && placements[course.entry_ladder] >= course.level_out;
    const warnings: CourseScore['warnings'] = softMissing.map((c) => ({ code: 'soft_prereq' as const, course_id: c }));
    if (F < 1) warnings.push({ code: 'heavy_load', weekly_hours: Math.round(weekly * 10) / 10 });
    return {
      course_id: course.course_id, eligible, ineligible, a_raw, A, U, B, F, p_soft, score,
      recommended: eligible && !below_placement && A > 0 && score >= config.course.min_score - 1e-9,
      below_placement,
      gains, goal_ids: helped, unlocks: bestUnlock ?? unlocked[0]?.course_id ?? null, warnings,
    };
  });

  const entry = new Map(active.map((c) => [c.course_id, c.entry_level]));
  return scored.sort((a, b) =>
    Number(b.recommended) - Number(a.recommended) ||
    cmpDesc(a.score, b.score) || cmpDesc(a.A, b.A) || (entry.get(a.course_id)! - entry.get(b.course_id)!) || a.course_id.localeCompare(b.course_id));
}
