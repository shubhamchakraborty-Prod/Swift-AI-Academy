import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EngineConfig, ReferenceData } from '../engine/types';

export const SEED_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../seed/v1');
export const SEED_REFERENCE_VERSION = 'v1.0.0';

const read = <T>(dir: string, file: string): T => JSON.parse(readFileSync(join(dir, file), 'utf8')) as T;

/** Loads the versioned seed JSON files (Section 9 of the PRD). */
export function loadSeed(dir = SEED_DIR): { reference: ReferenceData; config: EngineConfig } {
  const reference: ReferenceData = {
    version: SEED_REFERENCE_VERSION,
    skills: read(dir, 'skills.json'),
    career_goals: read(dir, 'career_goals.json'),
    fields: read(dir, 'fields.json'),
    courses: read(dir, 'courses.json'),
    items: read(dir, 'assessment_items.json'),
    personas: read(dir, 'personas.json'),
    persona_rules: read(dir, 'persona_rules.json'),
    templates: read(dir, 'templates.json'),
  };
  return { reference, config: read(dir, 'engine_config.json') };
}
