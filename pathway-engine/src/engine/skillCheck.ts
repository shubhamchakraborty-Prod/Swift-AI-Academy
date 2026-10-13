import type { EngineConfig, SkillCheckItem } from './types';

export interface SkillCheckState {
  done: boolean;
  placement: number;
  next_item_id: string | null;
  /** Bands or levels attempted, for mentor display. */
  trail: { step: number; correct: number; total: number; passed: boolean }[];
}

type Answers = Record<string, boolean>; // item_id -> correct

const placementItems = (items: SkillCheckItem[], series: 'ai' | 'comm') =>
  items.filter((i) => i.series === series && i.role === 'placement' && i.status === 'active');

/** AI ladder: start at Level 1; both items correct moves up; otherwise stop. */
export function aiSkillCheck(items: SkillCheckItem[], answers: Answers, config: EngineConfig): SkillCheckState {
  const pool = placementItems(items, 'ai');
  const trail: SkillCheckState['trail'] = [];
  let placement = 0;
  for (const level of config.skill_check.ai.levels) {
    const levelItems = pool.filter((i) => i.level_or_band === level).sort((a, b) => a.item_id.localeCompare(b.item_id));
    const unanswered = levelItems.find((i) => !(i.item_id in answers));
    if (unanswered) return { done: false, placement, next_item_id: unanswered.item_id, trail };
    const correct = levelItems.filter((i) => answers[i.item_id]).length;
    const passed = correct === levelItems.length;
    trail.push({ step: level, correct, total: levelItems.length, passed });
    if (!passed) break;
    placement = level;
  }
  return { done: true, placement, next_item_id: null, trail };
}

/** Communication ladder: adaptive by band, start band from education stage, one step down allowed. */
export function commSkillCheck(items: SkillCheckItem[], answers: Answers, educationStage: string, config: EngineConfig): SkillCheckState {
  const c = config.skill_check.comm;
  const pool = placementItems(items, 'comm');
  const strandRank = (s: string | null) => {
    const i = c.strand_order.indexOf(s ?? '');
    return i < 0 ? c.strand_order.length : i;
  };
  const start = c.start_band[educationStage] ?? 1;
  const passed = new Set<number>();
  const failed = new Set<number>();
  const trail: SkillCheckState['trail'] = [];
  let band = start;
  let downMoves = 0;
  const finish = (): SkillCheckState => {
    const best = Math.max(0, ...passed);
    return { done: true, placement: best ? c.band_level[String(best)] : 0, next_item_id: null, trail };
  };
  for (;;) {
    const bandItems = pool.filter((i) => i.level_or_band === band).sort((a, b) => strandRank(a.strand) - strandRank(b.strand) || a.item_id.localeCompare(b.item_id));
    const unanswered = bandItems.find((i) => !(i.item_id in answers));
    if (unanswered) {
      const best = Math.max(0, ...passed);
      return { done: false, placement: best ? c.band_level[String(best)] : 0, next_item_id: unanswered.item_id, trail };
    }
    const correct = bandItems.filter((i) => answers[i.item_id]).length;
    const ok = correct >= c.pass_min_correct;
    trail.push({ step: band, correct, total: bandItems.length, passed: ok });
    if (ok) {
      passed.add(band);
      const next = band + 1;
      if (next > c.bands || failed.has(next)) return finish();
      band = next;
    } else {
      failed.add(band);
      if (band === start && downMoves < c.max_down_moves && band > 1) {
        downMoves++;
        band -= 1;
      } else return finish();
    }
  }
}

/** Starting Point tie-breaker: one extra AI item one level above the learner's placement. */
export function tiebreakSkillItem(items: SkillCheckItem[], aiPlacement: number, config: EngineConfig): SkillCheckItem | null {
  const levels = config.skill_check.ai.levels;
  const level = Math.min(levels[levels.length - 1], aiPlacement + 1);
  return items.find((i) => i.series === 'ai' && i.role === 'tiebreak' && i.level_or_band === level && i.status === 'active') ?? null;
}

/**
 * Diligence: yes if all parts were done in one sitting (no gap longer than the sitting gap)
 * and total active time is within the configured ratio of the expected time.
 */
export function diligenceFlag(answerTimes: number[], totalActiveSeconds: number, config: EngineConfig): boolean {
  const a = config.assessment;
  const sorted = [...answerTimes].sort((x, y) => x - y);
  for (let i = 1; i < sorted.length; i++) if (sorted[i] - sorted[i - 1] > a.sitting_gap_minutes * 60_000) return false;
  const ratio = totalActiveSeconds / (a.expected_total_minutes * 60);
  return ratio >= a.diligence_ratio.min && ratio <= a.diligence_ratio.max;
}
