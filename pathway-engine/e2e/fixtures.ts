import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const items = JSON.parse(readFileSync(join(process.cwd(), 'seed/v1/assessment_items.json'), 'utf8'));
export const SHOTS = process.env.SHOTS_DIR;

export async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
}

/** Learner A's item answers (worked example), keyed by statement text. */
const B_VALUES: Record<string, number> = {
  'LP-P1': 4, 'LP-P2': 3, 'LP-P3': 4, 'LP-P4': 3, 'LP-D1': 5, 'LP-D2': 4, 'LP-D3': 4, 'LP-D4': 4, 'LP-I1': 3, 'LP-I2': 3, 'LP-I3': 3, 'LP-I4': 3,
  'LP-T1': 2, 'LP-T2': 2, 'LP-T3': 3, 'LP-T4': 2, 'LP-SD1': 4, 'LP-SD2': 4, 'LP-SD3': 4, 'LP-SD4': 3, 'LP-SD5': 4, 'LP-LI1': 4, 'LP-LI2': 4, 'LP-LI3': 2, 'LP-LI4': 4,
  'LP-LM1': 4, 'LP-LM2': 4, 'LP-LM3': 3, 'LP-LM4': 4, 'LP-GC1': 3, 'LP-GC2': 3, 'LP-GC3': 3, 'LP-CE1': 3, 'LP-CE2': 3, 'LP-CE3': 3, 'LP-CT1': 3, 'LP-CT2': 2, 'LP-CT3': 3,
  'LP-Q1': 4, 'LP-Q2': 1,
};
export const partB: { text: string; label: string }[] = items.part_b.map((i: any) => ({
  text: i.text_en,
  label: items.response_sets[i.response_set].find((o: any) => o.value === B_VALUES[i.item_id]).label_en,
}));
export const skillItems: Record<string, { correct: string; wrong: string; text: string }> = Object.fromEntries(
  items.part_c.map((i: any) => [i.text_en, {
    text: i.text_en,
    correct: i.options.find((o: any) => o.value === i.answer).label_en,
    wrong: i.options.find((o: any) => o.value !== i.answer).label_en,
  }]),
);

export async function choose(page: Page, label: string) {
  await page.getByRole('radio', { name: label, exact: true }).click();
}

/** Answers the current skill-check task: correct unless `fail` says otherwise. */
let lastTask = '';
export async function answerSkillTask(page: Page, fail: (text: string) => boolean) {
  const heading = page.locator('h1.q-text');
  await expect(heading).toBeVisible();
  if (lastTask) await expect(heading).not.toHaveText(lastTask);
  const text = (await heading.textContent())!.trim();
  const item = skillItems[text];
  if (!item) throw new Error(`Unknown task: ${text}`);
  await page.getByRole('radio', { name: fail(text) ? item.wrong : item.correct, exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  lastTask = text;
  return text;
}
