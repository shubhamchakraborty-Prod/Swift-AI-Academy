import type { Axis, AxisParameter, EngineConfig, Persona, ReferenceData } from './types';
import type { Features } from './features';
import { clamp } from './util';

export interface ParameterResult {
  id: string;
  label: string;
  weight: number;
  value: number | null; // null = left out (Part B flagged or no data)
}

export interface AxisResult {
  axis: string;
  name: string;
  base_score: number; // before any tie-breaker
  score: number; // final
  parameters: ParameterResult[];
  tiebreak_value: number | null;
  borderline: boolean;
  pole: 'positive' | 'negative';
  pole_letter: string;
  pole_name: string;
  pole_reason: 'sign' | 'supportive_default';
}

export interface PersonaResult {
  axes: AxisResult[];
  persona_code: string;
  secondary_code: string;
  confidence: number;
  confidence_label: string;
  /** Axes that need a tie-breaker (closest to zero first), fixed from the base scores. */
  tiebreak_axes: string[];
  tiebreak_pending: string[];
}

function convert(param: AxisParameter, f: Features): number | null {
  const c = param.conversion;
  switch (c.type) {
    case 'scale_centered': {
      if (!f.scales) return null;
      const vals = c.scales.map((s) => f.scales![s]);
      if (vals.some((v) => v === undefined)) return null;
      const m = vals.reduce((a, b) => a + b, 0) / vals.length;
      return (m - 3) / 2;
    }
    case 'lookup': {
      const v = f.values[c.feature];
      if (v === null || v === undefined) return null;
      return c.map[String(v)] ?? null;
    }
    case 'bands': {
      const v = f.values[c.feature];
      if (v === null || v === undefined) return null;
      for (const b of c.bands) if (Number(v) >= b.min - 1e-9) return b.value;
      return c.else;
    }
    case 'linear': {
      const v = f.values[c.feature];
      if (v === null || v === undefined) return null;
      return clamp((Number(v) - c.offset) / c.divisor, c.min, c.max);
    }
    case 'max_lookup': {
      const hits = c.lookups.map((l) => l.map[String(f.values[l.feature])]).filter((x): x is number => typeof x === 'number');
      return hits.length ? Math.max(...hits) : null;
    }
  }
}

/** Weighted mean over parameters that have a value; weights rescale to sum to 1. */
function axisScore(params: ParameterResult[], tiebreak: number | null, tiebreakWeight: number): number {
  let num = 0;
  let den = 0;
  for (const p of params) {
    if (p.value === null) continue;
    num += p.weight * p.value;
    den += p.weight;
  }
  if (tiebreak !== null) {
    num += tiebreakWeight * tiebreak;
    den += tiebreakWeight;
  }
  return den > 0 ? num / den : 0;
}

export function personaFromPoles(ref: ReferenceData, letters: string[]): Persona {
  const code = 'PER-' + letters.join('');
  const p = ref.personas.personas.find((x) => x.persona_code === code);
  if (!p) throw new Error(`Unknown persona ${code}`);
  return p;
}

/** Nearest persona centre (Euclidean). In v1 this equals the sign pattern; built this way so centres can move later. */
function nearestPersona(ref: ReferenceData, point: number[]): Persona {
  let best: Persona | null = null;
  let bestD = Infinity;
  for (const p of ref.personas.personas) {
    const d = p.centre.reduce((s, c, i) => s + (c - point[i]) ** 2, 0);
    if (d < bestD - 1e-12) {
      bestD = d;
      best = p;
    }
  }
  return best!;
}

/** Step 7: four axis scores, tie-breakers, supportive defaults, confidence and second choice. */
export function matchPersona(f: Features, ref: ReferenceData, config: EngineConfig, tiebreaks: Record<string, number>): PersonaResult {
  const pc = config.persona;
  const rules = ref.persona_rules;
  const supportiveNegative = rules.supportive_pole === 'negative';

  const prelim = rules.axes.map((axis: Axis) => {
    const parameters = axis.parameters.map((p) => ({ id: p.id, label: p.label, weight: p.weight, value: convert(p, f) }));
    return { axis, parameters, base: axisScore(parameters, null, pc.tiebreak_weight) };
  });

  const tiebreak_axes = prelim
    .map((x, i) => ({ id: x.axis.axis, abs: Math.abs(x.base), i }))
    .filter((x) => x.abs < pc.borderline)
    .sort((a, b) => a.abs - b.abs || a.i - b.i)
    .slice(0, pc.max_tiebreaks)
    .map((x) => x.id);

  const axes: AxisResult[] = prelim.map(({ axis, parameters, base }) => {
    const tb = tiebreak_axes.includes(axis.axis) && axis.axis in tiebreaks ? tiebreaks[axis.axis] : null;
    const score = axisScore(parameters, tb, pc.tiebreak_weight);
    const borderline = Math.abs(score) < pc.borderline;
    const positive = borderline ? !supportiveNegative : score >= 0;
    const pole = positive ? axis.positive : axis.negative;
    return {
      axis: axis.axis,
      name: axis.name,
      base_score: base,
      score,
      parameters,
      tiebreak_value: tb,
      borderline,
      pole: positive ? 'positive' : 'negative',
      pole_letter: pole.letter,
      pole_name: pole.name,
      pole_reason: borderline ? 'supportive_default' : 'sign',
    };
  });

  const point = axes.map((a) => (a.pole === 'positive' ? 0.5 : -0.5));
  const persona = nearestPersona(ref, point);
  const weakest = axes.reduce((w, a, i) => (Math.abs(a.score) < Math.abs(axes[w].score) - 1e-12 ? i : w), 0);
  const secondPoint = point.map((v, i) => (i === weakest ? -v : v));
  const secondary = nearestPersona(ref, secondPoint);

  const confidence = axes.reduce((s, a) => s + Math.abs(a.score), 0) / axes.length;
  let confidence_label = pc.confidence_bands[pc.confidence_bands.length - 1].label;
  for (const b of pc.confidence_bands) {
    if (b.below !== undefined && confidence < b.below) { confidence_label = b.label; break; }
    if (b.upto !== undefined && confidence <= b.upto) { confidence_label = b.label; break; }
  }

  return {
    axes,
    persona_code: persona.persona_code,
    secondary_code: secondary.persona_code,
    confidence,
    confidence_label,
    tiebreak_axes,
    tiebreak_pending: tiebreak_axes.filter((a) => !(a in tiebreaks)),
  };
}
