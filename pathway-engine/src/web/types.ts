/**
 * Shapes of the API responses the screens use. Keep in sync with services/results.ts and engineRunner.progress().
 */
export type Step = 'about' | 'profile' | 'skill_ai' | 'skill_comm' | 'goals' | 'tiebreak' | 'plan' | 'results' | 'dashboard';

export interface Progress {
  learner_id: string;
  first_name: string;
  step: Step;
  guardian_status: 'not_needed' | 'given' | 'pending';
  next_part_a_item: string | null;
  profile: Record<string, any>;
  goals: { goal_areas: string[]; main_goal: string; earning_need: string; mobility: string } | null;
  part_b: { open: boolean; answered: number; answers: Record<string, number>; retake: boolean };
  pending_tiebreaks: string[];
  pathway_id: string | null;
  pathway_status: string | null;
}

export interface Option { value: string; label_en: string; label?: string }

export interface ProfileItem {
  item_id: string;
  field: string;
  type: 'single' | 'multi' | 'state_district' | 'experience' | 'goal_cards' | 'text';
  required: boolean;
  text_en: string;
  help_en?: string;
  options?: Option[];
  none_option?: Option;
  sub_question?: { field: string; text_en: string; options: Option[]; skip_when: string[] };
  max_length?: number;
}

export interface SkillGained {
  skill_id: string; name: string; definition: string; from: number; to: number;
  helps: { goal_id: string; goal_name: string; roles: string[]; in_your_plan: boolean }[];
}

export interface Term {
  term_no: number; months: string; course_id: string; title: string; nsqf_label: string; hours_total: number | null;
  locked: boolean; status: 'planned' | 'active' | 'passed' | 'failed'; starts_on: string | null; ends_on: string | null;
  sentence: string; reason_skills: { skill_id: string; name: string; from: number; to: number }[];
  skills_gained: SkillGained[]; goal_areas: string[]; unlocks: { course_id: string; title: string } | null; warnings: string[]; modules: string[];
}

export interface Results {
  pathway_id: string;
  status: 'proposed' | 'accepted' | 'active' | 'completed';
  banner: { message: string; at: string; changes: string[] } | null;
  persona: { code: string; name: string; one_line: string; meaning: string; support_mode: string; preset: string; poles: { axis: string; pole: string }[]; feedback: string | null };
  interests: { orientation: string; name: string; score: number }[] | null;
  part_b_used: boolean;
  part_b_retake: { eligible: boolean; available_at: string | null; used: boolean };
  goals: { goal_id: string; name: string; definition: string; example_roles: string[]; reasons: string[]; chosen: boolean }[];
  chosen_goals: string[];
  goal_note: string | null;
  top_gaps: { skill_id: string; name: string; definition: string; current: number; needed: number }[];
  pathway: {
    length_months: 6 | 12; default_length: 6 | 12 | '6_then_extend'; can_change_length: boolean; summary: string | null;
    exploring_note: string | null; shortened: boolean; skills_gained: SkillGained[]; terms: Term[];
  };
  explore_option: { course_id: string; title: string; goal_name: string } | null;
  build_elsewhere: { skill_id: string; name: string; needed: number; after_plan: number; catalogue_max: number }[];
  level_scale: { level: number; descriptor: string }[];
  templates: { build_elsewhere: string; no_course: string; shorter_pathway: string };
}
