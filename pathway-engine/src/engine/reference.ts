/**
 * Reference learners (Section 21): 20 hand-designed learners in seed/v1/reference_learners.json
 * used by the simulation screen and by the automated tests. Their Part B is given as scale means; this file turns
 * those means into the same PartBScores shape the real scoring produces.
 */
import type { EngineInput, PartBScores } from './types';

type Means = Record<'people' | 'data' | 'ideas' | 'things' | 'self_discipline' | 'learning_independence' | 'learning_motivation' | 'goal_clarity' | 'conf_english' | 'conf_tech', number>;

/** Part B scores from scale means, for reference learners whose answers are specified as means. */
export function partBFromScaleMeans(m: Means, orientations: string[], flagged = false): PartBScores {
  const interests: Record<string, number> = Object.fromEntries(orientations.map((o) => [o, m[o as keyof Means]]));
  const rank = [...orientations].sort((a, b) => interests[b] - interests[a] || orientations.indexOf(a) - orientations.indexOf(b));
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

export interface ReferenceLearner {
  id: string;
  label: string;
  expected: Record<string, unknown>;
  input: Omit<EngineInput, 'partB'> & { partB: null; partB_means: Means; partB_flagged?: boolean };
}

export function referenceInput(r: ReferenceLearner, orientations: string[]): EngineInput {
  const { partB_means, partB_flagged, ...rest } = r.input;
  return { ...rest, partB: partBFromScaleMeans(partB_means, orientations, Boolean(partB_flagged)) };
}
