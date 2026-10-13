import type { EngineInput, PartBScores } from '../src/engine/types';

/** Part B scores from scale means (bypasses item answers when a test only needs the means). */
export function partBFromMeans(m: { people: number; data: number; ideas: number; things: number; self_discipline: number; learning_independence: number; learning_motivation: number; goal_clarity: number; conf_english: number; conf_tech: number }, flagged = false): PartBScores {
  const order = ['people', 'data', 'ideas', 'things'];
  const interests: Record<string, number> = { people: m.people, data: m.data, ideas: m.ideas, things: m.things };
  const rank = [...order].sort((a, b) => interests[b] - interests[a] || order.indexOf(a) - order.indexOf(b));
  return {
    scales: { ...m },
    interests,
    interest_rank: rank,
    top_orientation: rank[0],
    interest_focus: interests[rank[0]] - interests[rank[1]],
    flagged,
    flags: flagged ? ['attention:LP-Q1'] : [],
  };
}

/** Learner A from the specification's worked example (Section 20). */
export function learnerA(): EngineInput {
  return {
    profile: {
      age: 19, education_stage: 'ug_2', time_left: 'about_1', field_of_study: 'bcom', certificates: [],
      work_experience: 'none', role_level: 'none', device: 'phone_and_laptop', internet: 'reliable', weekly_hours: '3_to_5',
    },
    partB: partBFromMeans({ people: 3.5, data: 4.25, ideas: 3.0, things: 2.25, self_discipline: 3.8, learning_independence: 4.0, learning_motivation: 3.75, goal_clarity: 3.0, conf_english: 3.0, conf_tech: 8 / 3 }),
    ai_placement: 0,
    comm_placement: 3,
    diligence: true,
    goals: { goal_areas: ['CG-02'], main_goal: 'job_1_2y', earning_need: '1_2y', mobility: 'state' },
    tiebreaks: { goal_horizon: 1 },
    courses: [],
  };
}
