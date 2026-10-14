/**
 * Step 3 (PRD) / Section 10 (spec): scores the 40-statement learning profile (Part B).
 * Input: item bank + the learner's 1-5 answers + total seconds. Output: scale means, interest ranking, quality flags.
 * A flagged attempt is stored but every later step ignores it (see features.ts and goals.ts).
 * Thresholds (attention answers, straight-line count, minimum seconds) live in engine_config.assessment.quality.
 */
import type { EngineConfig, PartBItem, PartBScores } from './types';
import { mean } from './util';

export class IncompleteError extends Error {
  constructor(public part: string, public missing: string[]) {
    super(`Part ${part} is incomplete`);
  }
}

/**
 * Step 3: score the learning profile. Reverse-keyed items flip (6 - answer); scale = mean of items.
 * Quality checks flag the attempt; a flagged attempt is stored but not used later.
 */
export function scoreLearningProfile(
  items: PartBItem[],
  responses: Record<string, number>,
  seconds: number,
  orientationOrder: string[],
  config: EngineConfig,
): PartBScores {
  const active = items.filter((i) => i.status === 'active');
  const missing = active.filter((i) => !(i.item_id in responses)).map((i) => i.item_id);
  if (missing.length) throw new IncompleteError('B', missing);

  const byScale: Record<string, number[]> = {};
  for (const item of active) {
    if (item.key === 'Q') continue;
    const raw = responses[item.item_id];
    const v = item.key === 'R' ? 6 - raw : raw;
    (byScale[item.scale] ??= []).push(v);
  }
  const scales: Record<string, number> = {};
  for (const [s, vs] of Object.entries(byScale)) scales[s] = mean(vs);

  const interests: Record<string, number> = {};
  for (const o of orientationOrder) if (o in scales) interests[o] = scales[o];
  // Ties keep the fixed orientation order so ranking is deterministic.
  const interest_rank = [...orientationOrder].filter((o) => o in interests).sort((a, b) => interests[b] - interests[a] || orientationOrder.indexOf(a) - orientationOrder.indexOf(b));
  const interest_focus = interests[interest_rank[0]] - interests[interest_rank[1]];

  const q = config.assessment.quality;
  const flags: string[] = [];
  for (const [itemId, allowed] of Object.entries(q.attention)) {
    if (itemId in responses && !allowed.includes(responses[itemId])) flags.push(`attention:${itemId}`);
  }
  const counts = new Map<number, number>();
  for (const item of active) counts.set(responses[item.item_id], (counts.get(responses[item.item_id]) ?? 0) + 1);
  if (Math.max(...counts.values()) >= q.straight_line_min) flags.push('straight_line');
  if (seconds < q.min_seconds) flags.push('speeding');

  return { scales, interests, interest_rank, top_orientation: interest_rank[0], interest_focus, flagged: flags.length > 0, flags };
}
