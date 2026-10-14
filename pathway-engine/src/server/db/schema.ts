/**
 * Postgres schema for the Pathway Engine. Runs on every start and is idempotent
 * (create ... if not exists), so add new tables or columns here with the same pattern.
 * Kept as a TypeScript string so serverless bundlers (Netlify) include it.
 */
export const SCHEMA = String.raw`
-- Pathway Engine v1 schema. Reference ontologies are stored as versioned snapshots
-- (reference_version) so any run can be replayed against the exact data it used.

create table if not exists reference_version (
  version text primary key,
  data jsonb not null,
  active boolean not null default false,
  base_version text,
  note text,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists engine_config (
  version text primary key,
  data jsonb not null,
  active boolean not null default false,
  base_version text,
  note text,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists learner (
  learner_id text primary key,
  token_hash text not null,
  name_enc text,
  dob_enc text,
  age int not null,
  guardian_status text not null check (guardian_status in ('not_needed', 'given', 'pending')),
  profile jsonb not null default '{}'::jsonb,
  goals jsonb,
  note_enc text,
  share_with_mentor boolean not null default false,
  persona_feedback text,
  status text not null default 'active' check (status in ('active', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists learner_consent (
  learner_id text not null references learner on delete cascade,
  purpose text not null,
  granted boolean not null,
  by_guardian boolean not null default false,
  guardian_name_enc text,
  guardian_relation text,
  at timestamptz not null default now()
);

create table if not exists assessment_attempt (
  attempt_id text primary key,
  learner_id text not null references learner on delete cascade,
  part text not null check (part in ('A', 'B', 'C_AI', 'C_COMM', 'D', 'TB')),
  reference_version text not null,
  status text not null default 'open' check (status in ('open', 'finished')),
  result jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists assessment_attempt_learner on assessment_attempt (learner_id, part);

create table if not exists learner_response (
  attempt_id text not null references assessment_attempt on delete cascade,
  item_id text not null,
  value jsonb not null,
  correct boolean,
  ms_taken int not null default 0,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, item_id)
);

create table if not exists learner_profile_score (
  attempt_id text primary key references assessment_attempt on delete cascade,
  learner_id text not null references learner on delete cascade,
  scores jsonb not null,
  flagged boolean not null,
  at timestamptz not null default now()
);

create table if not exists tiebreak_answer (
  learner_id text not null references learner on delete cascade,
  axis text not null,
  answer text not null,
  value double precision not null,
  at timestamptz not null default now(),
  primary key (learner_id, axis)
);

create table if not exists learner_course (
  learner_id text not null references learner on delete cascade,
  course_id text not null,
  status text not null check (status in ('passed', 'failed')),
  source text not null check (source in ('course_assessment', 'self_report')),
  at timestamptz not null default now(),
  primary key (learner_id, course_id, source)
);

create table if not exists learner_skill_level (
  learner_id text not null references learner on delete cascade,
  skill_id text not null,
  level double precision not null,
  source text not null,
  at timestamptz not null default now(),
  primary key (learner_id, skill_id)
);

create table if not exists persona_match (
  match_id text primary key,
  learner_id text not null references learner on delete cascade,
  config_version text not null,
  reference_version text not null,
  axis_direction double precision, axis_start double precision, axis_goal double precision, axis_drive double precision,
  persona_code text not null,
  secondary_code text not null,
  confidence double precision not null,
  tiebreaks jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists recommendation_run (
  run_id text primary key,
  learner_id text,
  trigger text not null,
  config_version text not null,
  reference_version text not null,
  inputs jsonb not null,
  output jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists recommendation_run_learner on recommendation_run (learner_id, created_at);

create table if not exists pathway (
  pathway_id text primary key,
  run_id text not null references recommendation_run,
  learner_id text not null references learner on delete cascade,
  persona_code text not null,
  length_months int not null check (length_months in (6, 12)),
  status text not null check (status in ('proposed', 'accepted', 'active', 'completed', 'replaced')),
  explore_option text,
  banner jsonb,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index if not exists pathway_learner on pathway (learner_id, created_at);

create table if not exists pathway_term (
  pathway_id text not null references pathway on delete cascade,
  term_no int not null check (term_no in (1, 2)),
  course_id text not null,
  score double precision not null,
  reasons jsonb not null,
  locked boolean not null default false,
  status text not null default 'planned' check (status in ('planned', 'active', 'passed', 'failed')),
  starts_on text, -- ISO date
  ends_on text,
  primary key (pathway_id, term_no)
);

create table if not exists event_log (
  event_id text primary key,
  learner_id text,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  actor text not null,
  at timestamptz not null default now()
);

create table if not exists mentor_note (
  note_id text primary key,
  learner_id text not null references learner on delete cascade,
  author text not null,
  text_enc text not null,
  at timestamptz not null default now()
);

create table if not exists course_draft (
  course_id text primary key,
  data jsonb not null,
  validation jsonb,
  simulation jsonb,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create table if not exists item_draft (
  item_id text primary key,
  part text not null,
  data jsonb not null,
  status text not null default 'inactive' check (status in ('inactive', 'approved')),
  created_by text not null,
  created_at timestamptz not null default now()
);
`;
