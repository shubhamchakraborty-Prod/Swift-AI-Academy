import type { EngineConfig, ReferenceData } from './types';
import type { SkillState } from './skillLevels';
import { cmpDesc, roundToStep } from './util';

export interface SkillNeed {
  skill_id: string;
  demand: number; // D(s)
  required: number; // Lreq(s), multiple of the level step
  current: number; // Lnow(s)
  gap: number;
  goal_ids: string[]; // target goal areas listing this skill
}

/** Steps 9 / Section 13 Steps 2-3: demand, required level and gap for every skill the targets need. */
export function skillNeeds(ref: ReferenceData, config: EngineConfig, targets: { goal_id: string; weight: number }[], state: SkillState): SkillNeed[] {
  const acc = new Map<string, { d: number; num: number; den: number; goals: string[] }>();
  for (const t of targets) {
    for (const gs of ref.career_goals.goal_skills) {
      if (gs.goal_id !== t.goal_id || !(gs.skill_id in state)) continue;
      const a = acc.get(gs.skill_id) ?? { d: 0, num: 0, den: 0, goals: [] };
      a.d += t.weight * config.importance[gs.importance];
      a.num += t.weight * gs.required_level;
      a.den += t.weight;
      a.goals.push(t.goal_id);
      acc.set(gs.skill_id, a);
    }
  }
  const needs: SkillNeed[] = [];
  for (const [skill_id, a] of acc) {
    const required = a.den > 0 ? roundToStep(a.num / a.den, config.level_step) : 0;
    const current = state[skill_id].level;
    needs.push({ skill_id, demand: a.d, required, current, gap: Math.max(0, required - current), goal_ids: a.goals });
  }
  return needs.sort((x, y) => cmpDesc(x.demand * x.gap, y.demand * y.gap) || cmpDesc(x.demand, y.demand) || x.skill_id.localeCompare(y.skill_id));
}
