/** Maps each journey step to its screen URL and label key. Change the order of screens here and in App.tsx. */
import type { StrKey } from './strings';
import type { Step } from './types';

export function pathForStep(step: Step): string {
  switch (step) {
    case 'about': return '/journey/about';
    case 'profile': return '/journey/profile';
    case 'skill_ai': return '/journey/skills';
    case 'skill_comm': return '/journey/skills/communication';
    case 'goals': return '/journey/goals';
    case 'tiebreak': return '/journey/quick';
    case 'plan': return '/journey/building';
    case 'results': return '/results';
    case 'dashboard': return '/app';
  }
}

export const stepKey = (step: Step) => `step_${step}` as StrKey;

export const fmtLevel = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
export const fmtDate = (iso: string, locale = 'en-IN') => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
