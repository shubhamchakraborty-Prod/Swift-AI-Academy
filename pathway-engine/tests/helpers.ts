import type { EngineInput } from '../src/engine/types';
import { partBFromScaleMeans } from '../src/engine/reference';

export const ORIENTATIONS = ['people', 'data', 'ideas', 'things'];

/** Learner A from the specification's worked example (Section 20). */
export function learnerA(): EngineInput {
  return {
    profile: {
      age: 19, education_stage: 'ug_2', time_left: 'about_1', field_of_study: 'bcom', certificates: [],
      work_experience: 'none', role_level: 'none', device: 'phone_and_laptop', internet: 'reliable', weekly_hours: '3_to_5',
    },
    partB: partBFromScaleMeans({ people: 3.5, data: 4.25, ideas: 3.0, things: 2.25, self_discipline: 3.8, learning_independence: 4.0, learning_motivation: 3.75, goal_clarity: 3.0, conf_english: 3.0, conf_tech: 8 / 3 }, ORIENTATIONS),
    ai_placement: 0,
    comm_placement: 3,
    diligence: true,
    goals: { goal_areas: ['CG-02'], main_goal: 'job_1_2y', earning_need: '1_2y', mobility: 'state' },
    tiebreaks: { goal_horizon: 1 },
    courses: [],
  };
}
