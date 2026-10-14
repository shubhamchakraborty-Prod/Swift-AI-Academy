/**
 * Learner-facing wording (Step 12, Section 15). Every sentence comes from a fixed template in
 * seed/v1/templates.json and is checked against the banned-word list before it is returned.
 * To change wording: edit templates.json. To ban a new phrase: add a regex to templates.json "banned".
 */
import type { Templates } from './types';

export class WordingError extends Error {}

/** Throws if learner-facing text breaks a wording rule (Section 15). */
export function assertAllowed(text: string, templates: Templates): string {
  for (const b of templates.banned) {
    if (new RegExp(b.pattern, 'i').test(text)) throw new WordingError(`Blocked wording (${b.reason}): "${text}"`);
  }
  return text;
}

export function findBannedWords(text: string, templates: Templates): string[] {
  return templates.banned.filter((b) => new RegExp(b.pattern, 'i').test(text)).map((b) => b.reason);
}

/** Fill a fixed sentence template. Missing variables are an engine bug, so they throw. */
export function render(templates: Templates, key: string, vars: Record<string, string | number> = {}): string {
  const tpl = templates.templates[key];
  if (tpl === undefined) throw new Error(`Unknown template ${key}`);
  const out = tpl.replace(/\{(\w+)\}/g, (_, k: string) => {
    if (!(k in vars)) throw new Error(`Template ${key} is missing ${k}`);
    return String(vars[k]);
  });
  return assertAllowed(out, templates);
}

/** "a", "a and b", "a, b and c" */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
