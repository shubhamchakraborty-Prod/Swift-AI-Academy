import type { CourseRecord, EngineConfig, LearnerProfile, ReferenceData } from './types';

export type LevelSource = 'skill_check' | 'role_level' | 'default' | 'course_assessment' | 'self_report';
export interface SkillLevel { level: number; source: LevelSource }
export type SkillState = Record<string, SkillLevel>;

/**
 * Step 6: a starting level for every active skill.
 * Course passes raise levels to the course output; self-reported certificates raise at most to the self-report cap.
 */
export function startingSkillLevels(
  ref: ReferenceData,
  config: EngineConfig,
  profile: LearnerProfile,
  aiPlacement: number,
  commPlacement: number,
  courses: CourseRecord[],
): SkillState {
  const sl = config.skill_levels;
  const state: SkillState = {};
  for (const skill of ref.skills.skills) {
    if (skill.status !== 'active') continue;
    const rule = sl.rules.find((r) => (r.skill_ids ? r.skill_ids.includes(skill.skill_id) : r.family === skill.family_id));
    let level = sl.default;
    let source: LevelSource = 'default';
    if (rule?.source === 'ai_placement') { level = aiPlacement; source = 'skill_check'; }
    else if (rule?.source === 'comm_placement') { level = commPlacement; source = 'skill_check'; }
    else if (rule?.source === 'role_level') { level = rule.map?.[profile.role_level] ?? sl.default; source = 'role_level'; }
    state[skill.skill_id] = { level, source };
  }
  const courseById = new Map(ref.courses.courses.map((c) => [c.course_id, c]));
  for (const rec of courses) {
    if (rec.status !== 'passed') continue;
    const course = courseById.get(rec.course_id);
    if (!course) continue;
    for (const cs of course.skills) {
      const cur = state[cs.skill_id];
      if (!cur) continue;
      const target = rec.source === 'self_report' ? Math.min(cs.level_out, sl.self_report_cap) : cs.level_out;
      if (target > cur.level) state[cs.skill_id] = { level: target, source: rec.source };
    }
  }
  return state;
}

/** Simulated or real completion: raise each skill the course builds to its output level. */
export function raiseLevels(state: SkillState, ref: ReferenceData, courseId: string): SkillState {
  const course = ref.courses.courses.find((c) => c.course_id === courseId);
  const next: SkillState = { ...state };
  if (!course) return next;
  for (const cs of course.skills) {
    const cur = next[cs.skill_id];
    if (cur && cs.level_out > cur.level) next[cs.skill_id] = { level: cs.level_out, source: 'course_assessment' };
  }
  return next;
}
