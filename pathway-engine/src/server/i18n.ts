/**
 * Language support for learner-facing content (English and Hindi).
 *
 * English text lives in the seed files themselves. Hindi lives in seed/v1/i18n_hi.json, keyed by the same
 * stable ids (item_id, goal_id, skill_id, course_id, persona_code). Anything missing in Hindi falls back to
 * English, so a new course or item never breaks the Hindi screens; it simply shows in English until translated.
 *
 * The client sends its language in the `x-lang` header (or `?lang=`). Engine results are stored language-free
 * (ids + sentence variables) and rendered here, so a learner can switch language at any time.
 * Staff consoles stay in English.
 */
import type { Request } from 'express';
import hiData from '../../seed/v1/i18n_hi.json';
import type { Course, ReferenceData, Templates } from '../engine/types';
import { render } from '../engine/text';

export type Lang = 'en' | 'hi';
type HiCourse = { title?: string; outcome?: string; modules?: string[]; gate?: string; pitched_at?: string };
type HiItem = { text?: string; help?: string; stem?: string; none?: string; options?: Record<string, string>; sub_text?: string; sub_options?: Record<string, string> };
interface HiFile {
  items: Record<string, HiItem>;
  response_sets: Record<string, Record<string, string>>;
  goals: Record<string, { name: string; definition: string; roles: string[] }>;
  orientations: Record<string, string>;
  skills: Record<string, { name: string; definition: string }>;
  levels: Record<string, string>;
  fields: Record<string, string>;
  purposes: Record<string, string>;
  relations: Record<string, string>;
  states: Record<string, string>;
  series: Record<string, string>;
  courses: Record<string, HiCourse>;
  personas: Record<string, { name: string; one_line: string }>;
  axes: Record<string, string>;
  poles: Record<string, string>;
  tiebreak: Record<string, { question?: string; none?: string; options?: Record<string, string> }>;
  templates: Record<string, string>;
}
const HI = hiData as unknown as HiFile;

export function langOf(req: Request): Lang {
  const v = String(req.headers['x-lang'] ?? req.query.lang ?? 'en').toLowerCase();
  return v.startsWith('hi') ? 'hi' : 'en';
}

const fmtLevel = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

/** Lookups and sentence rendering in one language, with English fallback. */
export function makeLoc(ref: ReferenceData, lang: Lang) {
  const hi = lang === 'hi';
  const goals = new Map(ref.career_goals.goal_areas.map((g) => [g.goal_id, g]));
  const skills = new Map(ref.skills.skills.map((s) => [s.skill_id, s]));
  const courses = new Map(ref.courses.courses.map((c) => [c.course_id, c]));
  const personas = new Map(ref.personas.personas.map((p) => [p.persona_code, p]));
  const templates: Templates = hi ? { templates: { ...ref.templates.templates, ...HI.templates }, banned: ref.templates.banned } : ref.templates;

  const loc = {
    lang,
    goal(id: string) {
      const g = goals.get(id)!;
      const h = hi ? HI.goals[id] : undefined;
      return { goal_id: id, name: h?.name ?? g.name, definition: h?.definition ?? g.definition, roles: h?.roles ?? g.example_roles };
    },
    skill(id: string) {
      const s = skills.get(id)!;
      const h = hi ? HI.skills[id] : undefined;
      return { skill_id: id, name: h?.name ?? s.name, definition: h?.definition ?? s.definition };
    },
    course(id: string) {
      const c = courses.get(id)!;
      const h: HiCourse | undefined = hi ? HI.courses[id] : undefined;
      return {
        title: h?.title ?? c.title,
        outcome: h?.outcome ?? c.terminal_outcome,
        modules: h?.modules ?? c.modules.map((m) => m.title),
        gate: h?.gate ?? c.assessment_gate ?? null,
        pitched_at: h?.pitched_at ?? c.pitched_at ?? null,
      };
    },
    series(id: string) {
      return (hi && HI.series[id]) || ref.courses.series.find((s) => s.series_id === id)?.name || id;
    },
    nsqf(c: Course) {
      const n = c.nsqf_level.min === c.nsqf_level.max ? fmtLevel(c.nsqf_level.max) : `${fmtLevel(c.nsqf_level.min)} ${hi ? 'से' : 'to'} ${fmtLevel(c.nsqf_level.max)}`;
      return hi ? `NSQF स्तर ${n} के विवरणों के अनुसार बनाया गया` : `Designed against NSQF Level ${n} descriptors`;
    },
    persona(code: string) {
      const p = personas.get(code)!;
      const h = hi ? HI.personas[code] : undefined;
      return { name: h?.name ?? p.name, one_line: h?.one_line ?? p.one_line };
    },
    orientation(id: string) {
      return (hi && HI.orientations[id]) || ref.career_goals.orientations.find((o) => o.id === id)?.name || id;
    },
    axis(id: string, english: string) { return (hi && HI.axes[id]) || english; },
    pole(letter: string, english: string) { return (hi && HI.poles[letter]) || english; },
    level(n: number, english: string) { return (hi && HI.levels[String(n)]) || english; },
    field(id: string, english: string) { return (hi && HI.fields[id]) || english; },
    item(id: string): HiItem | undefined { return hi ? HI.items[id] : undefined; },
    responseLabel(set: string, value: number, english: string) { return (hi && HI.response_sets[set]?.[String(value)]) || english; },
    purpose(id: string, english: string) { return (hi && HI.purposes[id]) || english; },
    relation(id: string, english: string) { return (hi && HI.relations[id]) || english; },
    state(name: string) { return (hi && HI.states[name]) || name; },
    tiebreak(axis: string) { return hi ? HI.tiebreak[axis] : undefined; },
    template(key: string) { return templates.templates[key]; },
    render(key: string, vars: Record<string, string | number> = {}) { return render(templates, key, vars); },
    /** "a, b and c" / "a, b और c" */
    list(xs: string[]) {
      const and = hi ? 'और' : 'and';
      return xs.length <= 1 ? xs[0] ?? '' : `${xs.slice(0, -1).join(', ')} ${and} ${xs[xs.length - 1]}`;
    },
    /** A skill name used inside a sentence (English lower-cases the first letter, keeping acronyms). */
    inSentence(s: string) { return hi ? s : lowerFirst(s); },
  };
  return loc;
}
export type Loc = ReturnType<typeof makeLoc>;
