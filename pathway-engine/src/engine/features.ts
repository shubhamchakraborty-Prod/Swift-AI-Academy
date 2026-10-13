import type { EngineInput, ReferenceData } from './types';

/** Flat lookup of every value a persona parameter can read. Part B values are null when flagged. */
export interface Features {
  values: Record<string, string | number | null>;
  scales: Record<string, number> | null;
}

export function extractFeatures(input: EngineInput, ref: ReferenceData): Features {
  const { profile, goals, partB } = input;
  const usable = partB && !partB.flagged ? partB : null;
  let agreement: string = 'none';
  if (usable && goals.goal_areas.length) {
    const first = ref.career_goals.goal_areas.find((g) => g.goal_id === goals.goal_areas[0]);
    const primary = first?.primary_orientation;
    agreement = primary === usable.interest_rank[0] ? 'top' : primary === usable.interest_rank[1] ? 'second' : 'other';
  }
  return {
    scales: usable ? usable.scales : null,
    values: {
      education_stage: profile.education_stage,
      work_experience: profile.work_experience,
      device: profile.device,
      time_left: profile.time_left,
      weekly_hours: profile.weekly_hours,
      main_goal: goals.main_goal,
      earning_need: goals.earning_need,
      goal_count: String(goals.goal_areas.length),
      ai_placement: input.ai_placement,
      comm_placement: input.comm_placement,
      diligence: input.diligence ? 'yes' : 'no',
      interest_focus: usable ? usable.interest_focus : null,
      goal_interest_agreement: usable ? agreement : null,
    },
  };
}
