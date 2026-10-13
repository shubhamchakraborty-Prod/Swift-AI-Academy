import type { EngineConfig, PartBScores, Preset, ReferenceData } from './types';
import { cmpDesc } from './util';

export interface GoalScore {
  goal_id: string;
  asp: number;
  fit: number;
  field: number;
  market: number;
  score: number;
  rank: number;
}

export interface TargetGoal extends GoalScore {
  weight: number; // pi
  reasons: ('choice' | 'interests' | 'studies' | 'market')[];
}

/** Step 8: score all goal areas with the preset weights. Part B flagged -> fit weight 0, others rescaled. */
export function rankGoalAreas(
  ref: ReferenceData,
  config: EngineConfig,
  preset: Preset,
  chosen: string[],
  partB: PartBScores | null,
  fieldId: string,
): GoalScore[] {
  const usable = partB && !partB.flagged ? partB : null;
  let w = { ...config.goal.weights[preset] };
  if (!usable) {
    const rest = w.choice + w.field + w.market;
    w = { choice: w.choice / rest, fit: 0, field: w.field / rest, market: w.market / rest };
  }
  const field = ref.fields.fields.find((f) => f.field_id === fieldId);
  const interestValue = (o: string) => (usable ? (usable.interests[o] - 1) / 4 : 0);
  const scores = ref.career_goals.goal_areas
    .filter((g) => g.status === 'active')
    .map((g) => {
      const idx = chosen.indexOf(g.goal_id);
      const asp = idx >= 0 ? config.goal.asp[idx] ?? 0 : 0;
      const fit = usable ? config.goal.fit_split.primary * interestValue(g.primary_orientation) + config.goal.fit_split.secondary * interestValue(g.secondary_orientation) : 0;
      const fieldScore = field?.feeds.find((x) => x.goal_id === g.goal_id)?.weight ?? 0;
      const market = (g.market_outlook - 1) / 4;
      const score = w.choice * asp + w.fit * fit + w.field * fieldScore + w.market * market;
      return { goal_id: g.goal_id, asp, fit, field: fieldScore, market, score, rank: 0 };
    })
    .sort((a, b) => cmpDesc(a.score, b.score) || a.goal_id.localeCompare(b.goal_id));
  scores.forEach((s, i) => (s.rank = i + 1));
  return scores;
}

export function topGoals(ranked: GoalScore[], config: EngineConfig, preset: Preset, partBUsable: boolean): TargetGoal[] {
  const pi = config.goal.pi[preset];
  return ranked.slice(0, config.goal.top_n).map((g, i) => {
    const reasons: TargetGoal['reasons'] = [];
    if (g.asp > 0) reasons.push('choice');
    if (partBUsable && g.fit >= config.goal.reason_interest_min) reasons.push('interests');
    if (g.field > 0) reasons.push('studies');
    if (!reasons.length) reasons.push('market');
    return { ...g, weight: pi[i], reasons };
  });
}
