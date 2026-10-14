# Swift AI Academy Pathway Engine (v1, rule-based)

Recommends 1 or 2 Swift AI Academy courses (a 6-month or 12-month pathway) from the learner's own
4-part Swift Pathway Assessment, and explains every recommendation. No machine learning and no LLM:
every decision is a formula or an if-then rule over versioned data, so the same answers always give the
same plan and anyone can check it by hand.

Built from *Pathway Engine v2 (Hard-Coded) - Product Requirements* and *Swift AI Academy Pathway Engine v2 -
Backend Specification*. Section numbers in code comments refer to those documents.

## Run it

Needs Node 20.10 or newer. No database install needed for local use.

```bash
cd pathway-engine
npm install
npm run dev          # API on :8787 and screens on http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | API (auto-reload) + web app with hot reload |
| `npm test` | Engine, API and admin tests (Vitest) |
| `npm run e2e` | Builds the app and walks the full learner journey in Chromium, phone and desktop (Playwright) |
| `npm run typecheck` | TypeScript check |
| `npm run build` then `npm start` | Production build; one server serves API and screens (set the variables in `.env.example`) |

Staff consoles: open `/staff`. In development the access codes are in `.data/dev-secrets.json`.
Production: set `DATABASE_URL` to real Postgres and all secrets in `.env.example`.

## How it fits together

```
seed/v1/*.json ──(first start)──> reference_version + engine_config tables (versioned snapshots)
                                              │
Learner screens (src/web) ──REST /v1──> src/server (app.ts -> services/*) ──> src/engine (pure functions)
Course platform (LMS) ── POST /v1/learners/{id}/events ──┘                         │
Mentor + admin consoles (src/web/staff) ──────────────────┘          recommendation_run (full run log)
```

| Folder | Holds |
|---|---|
| `seed/v1` | All hard-coded data: 67 skills, 12 goal areas and their skill needs, fields of study, 13 courses, item bank, 16 personas, persona rules, sentence templates, engine config, 20 reference learners |
| `src/engine` | The rules, as pure deterministic functions. One file per step: `partB` (Step 3), `skillCheck` (4), `skillLevels` (6), `persona` (7), `goals` (8), `gaps` (9), `courses` (10), `pathway` (11), `run` (orchestrator), `text` (wording rules), `validateCourse` (Section 18) |
| `src/server` | Express API, Postgres schema (`db/schema.sql`), services that load answers, call the engine and store results |
| `src/web` | React screens. Learner flow in `screens/`, shared parts in `components/`, design tokens in `styles/tokens.css`, staff consoles in `staff/` |
| `tests` | Engine tests (worked example, every rule, 20 reference learners, personas) and API tests |
| `e2e` | Browser tests of the full journey and the staff consoles |

### Learner journey (screens)

Welcome → sign-up (name, date of birth, parent or guardian check under 17, consent) → About you (12 questions)
→ Learning profile (40 statements) → Skill check (AI, then Communication, adaptive) → Goals → quick question
(only if needed) → results (learner type, interests and directions, skills to build, plan) → Start this plan →
home with Plan / Skills / You tabs. Every answer is saved as it is given; closing the app and coming back resumes
at the next question.

### Recommendation logic in one paragraph

Part A gives background, Part B gives interest and habit scales, Part C places the learner on the AI ladder (0-4)
and the Communication ladder (0-8), Part D gives chosen goal areas and timing. Those set a starting level for each
skill and four persona axes, which pick 1 of 16 personas (and the Focus or Explore preset). Goal areas are ranked
by choice, interest fit, field of study and market outlook; the top 3 decide which skills matter and how much. Each
course is scored on how much of that weighted gap it closes (A), what it unlocks (U), how many of the 3 directions
it helps (B) and whether its weekly load fits the learner (F). Term 1 is the top course; term 2 is chosen after
simulating term 1 as passed. Reasons come only from fixed templates and are checked against banned words.

## How to change things

| I want to... | Do this | Code change? |
|---|---|---|
| Change a weight or threshold | Admin console → Config versions → edit, Simulate, Save, Activate. Or edit `seed/v1/engine_config.json` for a fresh install | No |
| Add a course | Admin console → Courses → New course (template Sections A-G) → Validate → Simulate → Activate | No |
| Activate BOT-1 | Admin console → Courses → BOT-1 → Edit, add hours and learning outcomes → Validate → Simulate → Activate | No |
| Change a skill need of a goal area | `seed/v1/career_goals.json` → `goal_skills` (new data version) | No |
| Map a new field of study or ITI trade | `seed/v1/fields.json` | No |
| Reword a sentence learners see | `seed/v1/templates.json` → `templates` | No |
| Ban a phrase | `seed/v1/templates.json` → `banned` (a regex) | No |
| Change an assessment item | `seed/v1/assessment_items.json` (keep the `item_id`; wording changes need content review) | No |
| Change the minimum age or guardian age | `engine_config.json` → `consent.min_age`, `consent.guardian_required_below_age` | No |
| Add a new kind of persona parameter | Add a conversion type in `src/engine/persona.ts` (`convert`) and use it in `persona_rules.json` | Yes |
| Add a screen | Component in `src/web/screens`, route in `src/web/App.tsx`, step in `src/web/journey.ts` | Yes |
| Add a table | `src/server/db/schema.sql` (statements must be idempotent) | Yes |

Rules that must hold after any change (the tests check them): same input gives the same output; no course,
skill or goal name in engine code; learners never see habit scores, axis numbers or course scores; no banned words.

## Decisions taken where the documents were silent or conflicted

| Topic | Decision |
|---|---|
| Age | Minimum age 15 (product instruction, replaces 17). Parent or guardian consent below 17 (product instruction; note the DPDP Act treats under-18s as children, so `guardian_required_below_age: 18` may be needed) |
| TC-5 vs formula | The formula alone would recommend AAI-2 to a learner at AI level 2 (it builds numerical accuracy). TC-5 forbids it, so a course whose output level the learner's placement already reaches is never recommended (`course.drop_at_or_below_placement`) |
| BOT-1 | Seeded as draft: hours and scope are unconfirmed (spec open item 10). Activate it from the admin console |
| Reference data storage | Ontologies are stored as versioned JSON snapshots, not 20 normalised tables, so any run replays against the exact data it used. Learner and engine-output tables follow Section 16 |
| Self-reported certificates (A10) | Count as completed for eligibility, but raise skill levels to 1 at most (self-report cap, Step 6) |
| Diligence flag | "One sitting" = no gap longer than 30 minutes between answers (`assessment.sitting_gap_minutes`) |
| Fields of study | The 8 FEEDS rows from the spec plus "Another field or trade" (field score 0) until the full table exists |
| Eligibility of COM-5 to COM-8 | Spec wording mapped to Part A options (for example "senior managerial" = manager role and over 2 years); spec open item 11 |
| Course delivery | Only AAI-1 has offline data. Others are treated as not offline-ready until confirmed |
| Listening items | Played with the device's speech engine from a transcript until recorded audio exists; learners can read the message instead |
| Sign-in | One learner per device (token in the browser). Staff use access codes. Replace both with platform SSO |

## Outstanding before real learners use it

| # | Item | Owner |
|---|---|---|
| 1 | Content review of draft items: 16 Communication items, 4 tie-breaker items, all distractors (marked `draft_pending_content_review`), plus skill definitions and Communication terminal outcomes | Content governance |
| 2 | Hindi versions of every item and screen (data model has `text_hi`; no Hindi content yet, so no language switch is shown) | Content governance |
| 3 | Recorded listening audio | Content teams |
| 4 | Confirm course skill tags, hours, delivery modes, BOT-1 scope | Content teams |
| 5 | Product sign-off of the 20 reference learners' expected outputs (persona codes are designed; pathways are engine baselines) | Product + pathways research |
| 6 | Confidence-check bands for the mentor view (shown as raw values for now) | Pathways research, after pilot |
| 7 | Assessment pilot with about 100 learners | Pathways research |
| 8 | Platform SSO for learners and staff; institution scoping for mentors | Engineering |
| 9 | Course platform integration (it must call the events endpoint) | Engineering |
| 10 | Seed finding: a learner aiming at Software, Bots & Apps with AI level 0 cannot be served until BOT-1 is active, so the engine falls back to their third direction | Product |
