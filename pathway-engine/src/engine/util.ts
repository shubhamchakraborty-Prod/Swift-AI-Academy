/**
 * Small numeric helpers shared by the engine. Scoring must be deterministic, so comparisons
 * use a tiny tolerance (EPS) to stop floating-point noise from flipping a ranking.
 */
const EPS = 1e-9;

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Round to the nearest multiple of `step`, halves up (3.75 -> 4 at step 0.5). */
export const roundToStep = (x: number, step: number) => Math.round(x / step + EPS) * step;

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

export const round2 = (x: number) => Math.round((x + Math.sign(x) * EPS) * 100) / 100;

/** Compare with tolerance so float noise never changes an ordering. */
export const cmpDesc = (a: number, b: number) => (Math.abs(a - b) < EPS ? 0 : b - a);
export const nearlyEqual = (a: number, b: number) => Math.abs(a - b) < EPS;

export const byKey = <T, K extends string | number>(xs: T[], key: (x: T) => K) => {
  const m = new Map<K, T>();
  for (const x of xs) m.set(key(x), x);
  return m;
};
