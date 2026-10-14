/**
 * Maps each journey step to its screen URL and label. Change the order of screens here and in App.tsx.
 */
import type { Step } from './types';

/** The four parts of the assessment, shown as story-style progress segments. */
export const PARTS = [
  { key: 'about', label: 'About you' },
  { key: 'profile', label: 'Learning profile' },
  { key: 'skills', label: 'Skill check' },
  { key: 'goals', label: 'Goals' },
] as const;

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

export const STEP_LABEL: Record<Step, string> = {
  about: 'About you',
  profile: 'Learning profile',
  skill_ai: 'Skill check',
  skill_comm: 'Skill check',
  goals: 'Goals',
  tiebreak: 'A quick question',
  plan: 'Your plan',
  results: 'Your plan is ready',
  dashboard: 'Your plan',
};

export const fmtLevel = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
export const fmtDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
