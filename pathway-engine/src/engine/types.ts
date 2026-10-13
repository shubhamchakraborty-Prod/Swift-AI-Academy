// Data contracts for the rule-based engine. Shapes mirror the seed JSON files in seed/v1.

export type Orientation = string; // ids from career_goals.orientations
export type Preset = 'focus' | 'explore';
export type SupportMode = 'light' | 'guided';
export type PathwayLength = 6 | 12;

export interface Skill {
  skill_id: string;
  name: string;
  cluster_id: string;
  family_id: string;
  definition: string;
  status: 'draft' | 'active' | 'retired';
}

export interface GoalArea {
  goal_id: string;
  name: string;
  definition: string;
  primary_orientation: Orientation;
  secondary_orientation: Orientation;
  market_outlook: number;
  example_roles: string[];
  status: 'active' | 'retired';
}

export interface GoalSkill {
  goal_id: string;
  skill_id: string;
  importance: 'core' | 'supporting';
  required_level: number;
}

export interface FieldOfStudy {
  field_id: string;
  name: string;
  feeds: { goal_id: string; weight: number }[];
}

export interface EligibilityRule {
  field: string;
  op: '>=' | '<=' | '==' | 'in';
  value: number | string | (number | string)[];
}

export interface CourseSkill {
  skill_id: string;
  level_out: number;
  primary: boolean;
  evidence?: string | null;
}

export interface Course {
  course_id: string;
  title: string;
  series_id: string;
  provider?: string;
  nsqf_level: { min: number; max: number };
  level_out: number;
  hours: { training: number; assessment: number; total: number; status?: string } | null;
  entry_level: number;
  entry_ladder: 'ai' | 'comm';
  prerequisites: { hard: string[]; soft: string[] };
  /** OR of AND groups. Empty = no extra rule. */
  eligibility: EligibilityRule[][];
  delivery: { modes: string[] | null; offline_ok: boolean | null; device_min: string | null; languages: string[] | null };
  terminal_outcome: string;
  terminal_outcome_source?: string;
  pitched_at?: string | null;
  modules: { title: string; hours?: number | null; outcomes?: { lo_id: string; text: string; type?: string; skill_ids: string[] }[] }[];
  assessment_gate?: string | null;
  skills: CourseSkill[];
  status: 'draft' | 'active' | 'retired';
  status_note?: string;
  version: number;
}

export interface Persona {
  persona_code: string;
  name: string;
  one_line: string;
  default_length: 6 | 12 | '6_then_extend';
  preset: Preset;
  support_mode: SupportMode;
  centre: number[];
}

export type Conversion =
  | { type: 'scale_centered'; scales: string[] }
  | { type: 'lookup'; feature: string; map: Record<string, number> }
  | { type: 'bands'; feature: string; bands: { min: number; value: number }[]; else: number }
  | { type: 'linear'; feature: string; offset: number; divisor: number; min: number; max: number }
  | { type: 'max_lookup'; lookups: { feature: string; map: Record<string, number> }[] };

export interface AxisParameter {
  id: string;
  label: string;
  weight: number;
  part_b?: boolean;
  conversion: Conversion;
}

export type Tiebreak =
  | { type: 'goal_pick'; question_en: string; none_label_en: string; score_pick: number; score_none: number }
  | { type: 'skill_item'; question_en: string; series: string; score_correct: number; score_wrong: number }
  | { type: 'choice'; question_en: string; options: { value: string; label_en: string; score: number }[] };

export interface Axis {
  axis: string;
  name: string;
  positive: { letter: string; name: string; learner_phrase: string };
  negative: { letter: string; name: string; learner_phrase: string };
  parameters: AxisParameter[];
  tiebreak: Tiebreak;
}

export interface PersonaRules {
  axes: Axis[];
  supportive_pole: 'negative' | 'positive';
}

export interface ItemOption {
  value: string;
  label_en: string;
  label_hi?: string | null;
}

export interface PartBItem {
  item_id: string;
  scale: string;
  text_en: string;
  stem_en?: string;
  response_set: 'interest' | 'agreement';
  key: '+' | 'R' | 'Q';
  quality_rule?: { allowed: number[] };
  order_no: number;
  status: string;
}

export interface SkillCheckItem {
  item_id: string;
  part: 'C';
  series: 'ai' | 'comm';
  role: 'placement' | 'tiebreak';
  level_or_band: number;
  strand: string | null;
  text_en: string;
  transcript_en: string | null;
  options: ItemOption[];
  answer: string;
  status: string;
  review_status?: string;
}

export interface ProfileItem {
  item_id: string;
  part: 'A' | 'D';
  field: string;
  type: string;
  required: boolean;
  text_en: string;
  help_en?: string;
  options?: ItemOption[];
  options_source?: 'fields' | 'courses';
  none_option?: ItemOption;
  sub_question?: { field: string; text_en: string; options: ItemOption[]; skip_when: string[]; value_when_skipped: string };
  max_select?: number;
  not_sure_value?: string;
  max_length?: number;
  status: string;
}

export interface ItemBank {
  response_sets: Record<'interest' | 'agreement', { value: number; label_en: string }[]>;
  part_a: ProfileItem[];
  part_b: PartBItem[];
  part_c: SkillCheckItem[];
  part_d: ProfileItem[];
  states: string[];
}

export interface Templates {
  templates: Record<string, string>;
  banned: { pattern: string; reason: string }[];
}

/** Everything the engine reads that is not a learner answer or a weight. One version per snapshot. */
export interface ReferenceData {
  version: string;
  skills: { families: { family_id: string; name: string }[]; clusters: { cluster_id: string; family_id: string; name: string }[]; skills: Skill[] };
  career_goals: { orientations: { id: string; name: string; description: string }[]; goal_areas: GoalArea[]; goal_skills: GoalSkill[] };
  fields: { fields: FieldOfStudy[] };
  courses: { series: { series_id: string; name: string; ladder: string }[]; courses: Course[] };
  items: ItemBank;
  personas: { personas: Persona[] };
  persona_rules: PersonaRules;
  templates: Templates;
}

export interface EngineConfig {
  version: string;
  consent: { min_age: number; guardian_required_below_age: number; purposes: { id: string; required: boolean; label_en: string }[] };
  assessment: {
    quality: { attention: Record<string, number[]>; straight_line_min: number; min_seconds: number };
    expected_total_minutes: number;
    diligence_ratio: { min: number; max: number };
    sitting_gap_minutes: number;
    max_item_seconds: number;
    part_b_retake_after_hours: number;
    part_b_max_retakes: number;
  };
  skill_check: {
    ai: { levels: number[] };
    comm: { start_band: Record<string, number>; band_level: Record<string, number>; bands: number; pass_min_correct: number; max_down_moves: number; strand_order: string[] };
  };
  skill_levels: {
    rules: { skill_ids?: string[]; family?: string; source: 'comm_placement' | 'ai_placement' | 'role_level'; map?: Record<string, number> }[];
    default: number;
    self_report_cap: number;
  };
  persona: { borderline: number; tiebreak_weight: number; max_tiebreaks: number; confidence_bands: { below?: number; upto?: number; label: string }[] };
  goal: {
    weights: Record<Preset, { choice: number; fit: number; field: number; market: number }>;
    pi: Record<Preset, number[]>;
    asp: number[];
    fit_split: { primary: number; secondary: number };
    top_n: number;
    reason_interest_min: number;
  };
  importance: { core: number; supporting: number };
  level_step: number;
  course: {
    weights: Record<Preset, { A: number; U: number; B: number; F: number }>;
    unlock_factor: number;
    soft_prereq_penalty: number;
    min_score: number;
    available_hours: Record<string, number>;
    format_fit: { partial_ratio: number; partial_value: number; offline_factor: number };
    top_reason_skills: number;
  };
  term: { weeks: number; months: number };
  results: { top_gaps: number };
}

/** Part A + Part D facts the engine reads. Values are option ids from the item bank. */
export interface LearnerProfile {
  age: number;
  education_stage: string;
  time_left: string;
  field_of_study: string;
  certificates: string[];
  work_experience: string;
  role_level: string;
  device: string;
  internet: string;
  weekly_hours: string;
}

export interface LearnerGoals {
  goal_areas: string[]; // ordered, 0 to 2; empty = "Not sure yet"
  main_goal: string;
  earning_need: string;
  mobility?: string;
}

export interface PartBScores {
  scales: Record<string, number>; // mean 1..5 per scale
  interests: Record<string, number>; // orientation id -> mean 1..5
  interest_rank: string[];
  top_orientation: string;
  interest_focus: number;
  flagged: boolean;
  flags: string[];
}

export interface CourseRecord {
  course_id: string;
  status: 'passed' | 'failed';
  source: 'course_assessment' | 'self_report';
}

export interface EngineInput {
  profile: LearnerProfile;
  partB: PartBScores | null;
  ai_placement: number;
  comm_placement: number;
  diligence: boolean;
  goals: LearnerGoals;
  /** axis id -> tie-breaker parameter value (-1..+1) */
  tiebreaks: Record<string, number>;
  courses: CourseRecord[];
  length_override?: PathwayLength | null;
  /** Terms that have started; never changed by the engine. */
  locked_terms?: { term_no: number; course_id: string }[];
}
