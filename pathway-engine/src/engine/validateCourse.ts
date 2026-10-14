/**
 * Section 18: the 8 onboarding checks a new or edited course must pass before activation.
 * Used by the admin console (POST /v1/admin/courses/:id/validate). Each check returns plain messages for the admin.
 */
import type { Course, ReferenceData } from './types';
import { findBannedWords } from './text';

export interface ValidationResult {
  ok: boolean;
  checks: { id: number; name: string; ok: boolean; messages: string[] }[];
}

/** Section 18 onboarding checks. `isNew` = course id must not exist in the live catalogue. */
export function validateCourse(course: Course, ref: ReferenceData, opts: { isNew: boolean; retiredIds?: string[] }): ValidationResult {
  const checks: ValidationResult['checks'] = [];
  const add = (id: number, name: string, messages: string[]) => checks.push({ id, name, ok: messages.length === 0, messages });
  const catalogue = ref.courses.courses;
  const others = catalogue.filter((c) => c.course_id !== course.course_id);

  add(1, 'Unique ID', [
    ...(!/^[A-Z]{2,5}-\d+$/.test(course.course_id) ? ['Course ID must look like SERIES-N, for example AAI-5'] : []),
    ...(opts.isNew && catalogue.some((c) => c.course_id === course.course_id) ? ['Course ID already exists'] : []),
    ...(opts.retiredIds?.includes(course.course_id) ? ['Course ID was retired and cannot be reused'] : []),
  ]);

  const lvl: string[] = [];
  for (const [k, v] of [['Output level', course.level_out], ['Entry level', course.entry_level]] as const) {
    if (!(v >= 0 && v <= 8) || Math.round(v * 2) !== v * 2) lvl.push(`${k} must be between 0 and 8 in steps of 0.5`);
  }
  if (course.level_out < course.entry_level) lvl.push('Output level is below entry level');
  for (const s of course.skills) if (s.level_out < course.entry_level || s.level_out > 8) lvl.push(`${s.skill_id}: output level must be between entry level and 8`);
  if (!course.hours || !(course.hours.total > 0)) lvl.push('Total hours are required');
  add(2, 'Level consistency', lvl);

  const active = new Set(ref.skills.skills.filter((s) => s.status === 'active').map((s) => s.skill_id));
  add(3, 'Skills exist', course.skills.filter((s) => !active.has(s.skill_id)).map((s) => `${s.skill_id} is not an active skill`));

  const ids = course.skills.map((s) => s.skill_id);
  add(4, 'Enough skills', [
    ...(course.skills.length < 3 ? ['At least 3 skills are required'] : []),
    ...(!course.skills.some((s) => s.primary) ? ['Mark at least one skill as primary'] : []),
    ...(new Set(ids).size !== ids.length ? ['A skill is listed twice'] : []),
  ]);

  const outcomes = course.modules.flatMap((m) => m.outcomes ?? []);
  const cov: string[] = [];
  for (const lo of outcomes) if (lo.skill_ids.length > 3) cov.push(`Learning outcome ${lo.lo_id} maps to more than 3 skills`);
  for (const s of course.skills.filter((x) => x.primary)) if (!outcomes.some((lo) => lo.skill_ids.includes(s.skill_id))) cov.push(`Primary skill ${s.skill_id} has no learning outcome`);
  if (!outcomes.length) cov.push('Add at least one module with learning outcomes');
  add(5, 'Outcome coverage', cov);

  const pre: string[] = [];
  const all = [...course.prerequisites.hard, ...course.prerequisites.soft];
  for (const p of all) if (p === course.course_id) pre.push('A course cannot require itself');
  else if (!others.some((c) => c.course_id === p)) pre.push(`Prerequisite ${p} does not exist`);
  // Loop check over hard and soft edges, with this course's edges replaced by the draft's.
  const edges = new Map(others.map((c) => [c.course_id, [...c.prerequisites.hard, ...c.prerequisites.soft]]));
  edges.set(course.course_id, all);
  const visiting = new Set<string>();
  const seen = new Set<string>();
  const loops = (n: string): boolean => {
    if (visiting.has(n)) return true;
    if (seen.has(n)) return false;
    visiting.add(n);
    const hit = (edges.get(n) ?? []).some(loops);
    visiting.delete(n);
    seen.add(n);
    return hit;
  };
  if (loops(course.course_id)) pre.push('Prerequisites form a loop');
  add(6, 'Prerequisites valid', pre);

  // Reachable: a learner who just meets the entry level would gain on at least one goal area's needs.
  const reachable = ref.career_goals.goal_skills.some((gs) => {
    const cs = course.skills.find((s) => s.skill_id === gs.skill_id);
    return cs && Math.min(cs.level_out, gs.required_level) > course.entry_level;
  });
  add(7, 'Reachable', reachable ? [] : ['The course adds no needed level for any goal area, so it would never be recommended']);

  const texts = [course.title, course.terminal_outcome, ...course.modules.map((m) => m.title), ...outcomes.map((o) => o.text)];
  add(8, 'Wording', texts.flatMap((t) => findBannedWords(t ?? '', ref.templates).map((r) => `"${t}": ${r}`)));

  return { ok: checks.every((c) => c.ok), checks };
}
