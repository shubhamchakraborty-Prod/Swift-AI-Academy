/**
 * Seed data (seed/v1/*.json), imported statically so it is bundled with the server
 * (works the same locally, in tests and in serverless functions).
 * These files are loaded into the database once, as reference data and config version v1.0.0.
 */
import type { EngineConfig, ReferenceData } from '../engine/types';
import type { ReferenceLearner } from '../engine/reference';
import skills from '../../seed/v1/skills.json';
import careerGoals from '../../seed/v1/career_goals.json';
import fields from '../../seed/v1/fields.json';
import courses from '../../seed/v1/courses.json';
import items from '../../seed/v1/assessment_items.json';
import personas from '../../seed/v1/personas.json';
import personaRules from '../../seed/v1/persona_rules.json';
import templates from '../../seed/v1/templates.json';
import engineConfig from '../../seed/v1/engine_config.json';
import referenceLearnerFile from '../../seed/v1/reference_learners.json';

export const SEED_REFERENCE_VERSION = 'v1.0.0';

/** Fresh copies each call, so callers can never mutate the bundled seed. */
export function loadSeed(): { reference: ReferenceData; config: EngineConfig } {
  const reference = structuredClone({
    version: SEED_REFERENCE_VERSION,
    skills, career_goals: careerGoals, fields, courses, items, personas, persona_rules: personaRules, templates,
  }) as unknown as ReferenceData;
  return { reference, config: structuredClone(engineConfig) as unknown as EngineConfig };
}

/** The 20 reference learners used by simulation and tests (Section 21). */
export function seedReferenceLearners(): ReferenceLearner[] {
  return structuredClone(referenceLearnerFile.learners) as unknown as ReferenceLearner[];
}
