import {
  BarChart3, Bot, Briefcase, Clapperboard, ConciergeBell, Factory, GraduationCap, HeartPulse, Landmark, Megaphone, Monitor, Wrench,
  Compass, type LucideIcon,
} from 'lucide-react';

/** Icons for the 12 fixed goal areas (locked in v1). Unknown ids fall back to a compass. */
const GOAL_ICONS: Record<string, LucideIcon> = {
  'CG-01': Briefcase, 'CG-02': Landmark, 'CG-03': Megaphone, 'CG-04': ConciergeBell, 'CG-05': GraduationCap, 'CG-06': HeartPulse,
  'CG-07': Wrench, 'CG-08': Factory, 'CG-09': Monitor, 'CG-10': Bot, 'CG-11': BarChart3, 'CG-12': Clapperboard,
};
export function GoalIcon({ id, size = 22 }: { id: string; size?: number }) {
  const I = GOAL_ICONS[id] ?? Compass;
  return <I size={size} strokeWidth={1.75} aria-hidden="true" />;
}
