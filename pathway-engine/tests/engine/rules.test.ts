import { describe, expect, it } from 'vitest';
import { loadSeed } from '../../src/server/referenceData';
import {
  aiSkillCheck, commSkillCheck, diligenceFlag, extractFeatures, matchPersona, referenceInput, runEngine, scoreLearningProfile, validateCourse,
  type Course, type EngineInput,
} from '../../src/engine';
import { referenceLearners } from '../../src/server/services/admin';
import { learnerA, ORIENTATIONS } from '../helpers';

const { reference: ref, config } = loadSeed();
const items = ref.items.part_b;
const allAnswers = (v: number) => Object.fromEntries(items.map((i) => [i.item_id, v]));

describe('Part B scoring (FR-4, FR-5)', () => {
  it('flips reverse-keyed items and averages each scale', () => {
    const a = { ...allAnswers(4), ...Object.fromEntries(['LP-D1', 'LP-D2', 'LP-D3', 'LP-D4', 'LP-I1', 'LP-I2', 'LP-I3', 'LP-I4', 'LP-T1'].map((k) => [k, 3])), 'LP-Q1': 4, 'LP-Q2': 1, 'LP-SD4': 2, 'LP-P1': 5, 'LP-P2': 5 };
    const s = scoreLearningProfile(items, a, 600, ORIENTATIONS, config);
    expect(s.scales.self_discipline).toBeCloseTo((4 + 4 + 4 + (6 - 2) + 4) / 5, 9);
    expect(s.scales.people).toBeCloseTo(4.5, 9);
    expect(s.top_orientation).toBe('people');
    expect(s.interest_focus).toBeCloseTo(4.5 - 3.75, 9);
    expect(s.flagged).toBe(false);
  });
  it.each([
    ['attention item LP-Q1 wrong', { 'LP-Q1': 3 }, 600, 'attention:LP-Q1'],
    ['attention item LP-Q2 wrong', { 'LP-Q2': 4 }, 600, 'attention:LP-Q2'],
    ['answered too fast', {}, 119, 'speeding'],
  ])('flags %s', (_n, patch, secs, flag) => {
    const a = { ...allAnswers(3), 'LP-Q1': 4, 'LP-Q2': 1, 'LP-P1': 5, 'LP-D1': 1, 'LP-I1': 2, 'LP-T1': 4, ...patch };
    const s = scoreLearningProfile(items, a, secs, ORIENTATIONS, config);
    expect(s.flags).toContain(flag);
    expect(s.flagged).toBe(true);
  });
  it('flags straight-lining at 36 of 40 identical answers', () => {
    const s = scoreLearningProfile(items, { ...allAnswers(4), 'LP-Q2': 1 }, 600, ORIENTATIONS, config);
    expect(s.flags).toContain('straight_line');
  });
  it('refuses incomplete answers', () => {
    expect(() => scoreLearningProfile(items, { 'LP-P1': 3 }, 600, ORIENTATIONS, config)).toThrow(/incomplete/);
  });
});

describe('skill check (FR-6, FR-7)', () => {
  const c = ref.items.part_c;
  const answers = (pred: (id: string, level: number) => boolean, series: 'ai' | 'comm') =>
    Object.fromEntries(c.filter((i) => i.series === series && i.role === 'placement').map((i) => [i.item_id, pred(i.item_id, i.level_or_band)]));
  it('AI ladder: highest level with both items right; Level 1 failed gives 0', () => {
    expect(aiSkillCheck(c, answers((_id, l) => l <= 2, 'ai'), config).placement).toBe(2);
    expect(aiSkillCheck(c, answers((id) => id !== 'SC-AI-1b', 'ai'), config).placement).toBe(0);
    expect(aiSkillCheck(c, answers(() => true, 'ai'), config).placement).toBe(4);
  });
  it('AI ladder stops at the first failed level and asks nothing above it', () => {
    const s = aiSkillCheck(c, { 'SC-AI-1a': true, 'SC-AI-1b': true, 'SC-AI-2a': false }, config);
    expect(s.done).toBe(false);
    expect(s.next_item_id).toBe('SC-AI-2b');
    expect(aiSkillCheck(c, { 'SC-AI-1a': true, 'SC-AI-1b': true, 'SC-AI-2a': false, 'SC-AI-2b': true }, config)).toMatchObject({ done: true, placement: 1 });
  });
  it('Communication starts by education stage and maps bands to levels', () => {
    expect(commSkillCheck(c, {}, 'class_10_or_below', config).next_item_id).toMatch(/^SC-COM-1/);
    expect(commSkillCheck(c, {}, 'iti_1', config).next_item_id).toMatch(/^SC-COM-2/);
    expect(commSkillCheck(c, {}, 'ug_3', config).next_item_id).toMatch(/^SC-COM-3/);
    expect(commSkillCheck(c, {}, 'graduate', config).next_item_id).toMatch(/^SC-COM-4/);
    // Graduate passes bands 4 and 5, fails 6 -> level 6
    expect(commSkillCheck(c, answers((_id, b) => b <= 5, 'comm'), 'graduate', config)).toMatchObject({ done: true, placement: 6 });
    // UG fails band 3, steps down once, passes band 2 -> level 3 (Learner A)
    expect(commSkillCheck(c, answers((_id, b) => b <= 2, 'comm'), 'ug_2', config)).toMatchObject({ done: true, placement: 3 });
    // Band 1 failed -> 0; 2 of 3 right still passes
    expect(commSkillCheck(c, answers(() => false, 'comm'), 'class_10_or_below', config).placement).toBe(0);
    expect(commSkillCheck(c, answers((id, b) => b <= 1 && !id.endsWith('V'), 'comm'), 'class_10_or_below', config).placement).toBe(2);
  });
  it('diligence: one sitting at a normal pace', () => {
    const t0 = Date.UTC(2026, 0, 1);
    expect(diligenceFlag([t0, t0 + 60_000], 25 * 60, config)).toBe(true);
    expect(diligenceFlag([t0, t0 + 60_000], 10 * 60, config)).toBe(false);
    expect(diligenceFlag([t0, t0 + 3_600_000], 25 * 60, config)).toBe(false);
  });
});

describe('persona tie-breakers (FR-12, TC-3, TC-4)', () => {
  // Learner A answers with each axis pushed near zero as needed.
  const near = (patch: Partial<EngineInput['goals']> & { hours?: string; diligence?: boolean; time_left?: string }) => {
    const x = learnerA();
    x.tiebreaks = {};
    if (patch.main_goal) x.goals.main_goal = patch.main_goal;
    if (patch.earning_need) x.goals.earning_need = patch.earning_need;
    if (patch.hours) x.profile.weekly_hours = patch.hours;
    if (patch.diligence !== undefined) x.diligence = patch.diligence;
    if (patch.time_left) x.profile.time_left = patch.time_left;
    return x;
  };
  it('no tie-breaker when every axis is outside ±0.15', () => {
    const x = near({ main_goal: 'higher_studies' });
    expect(matchPersona(extractFeatures(x, ref), ref, config, {}).tiebreak_axes).toEqual([]);
  });
  it('two borderline axes: exactly 2 tie-breakers, closest to zero first (TC-3)', () => {
    const x = near({ diligence: false }); // drive 0.08, horizon 0.09
    const p = matchPersona(extractFeatures(x, ref), ref, config, {});
    expect(p.tiebreak_axes).toEqual(['learning_drive', 'goal_horizon']);
  });
  it('three borderline axes: only 2 asked; the third takes its supportive pole (TC-4)', () => {
    const x = near({ diligence: false });
    x.profile.device = 'own_phone';
    x.ai_placement = 1;
    x.comm_placement = 4; // starting point near zero too
    const p = matchPersona(extractFeatures(x, ref), ref, config, {});
    const borderline = p.axes.filter((a) => Math.abs(a.base_score) < 0.15).map((a) => a.axis);
    expect(borderline.length).toBe(3);
    expect(p.tiebreak_axes).toHaveLength(2);
    const answered = matchPersona(extractFeatures(x, ref), ref, config, Object.fromEntries(p.tiebreak_axes.map((a) => [a, 1])));
    const third = answered.axes.find((a) => !p.tiebreak_axes.includes(a.axis) && borderline.includes(a.axis))!;
    expect(third.pole).toBe('negative');
    expect(third.pole_reason).toBe('supportive_default');
  });
});

describe('course rules', () => {
  it('AI placement 2: AAI-1 and AAI-2 never recommended, AAI-3 eligible (TC-5)', () => {
    const x = { ...learnerA(), ai_placement: 2 };
    const run = runEngine(x, ref, config);
    const scores = run.course_scores_by_term.flatMap((t) => t.scores);
    expect(scores.filter((s) => ['AAI-1', 'AAI-2'].includes(s.course_id)).every((s) => !s.recommended)).toBe(true);
    expect(run.course_scores_by_term[0].scores.find((s) => s.course_id === 'AAI-3')!.eligible).toBe(true);
    expect(run.pathway.terms.map((t) => t.course_id)).not.toContain('AAI-1');
  });
  it('Part B flagged: ignored, persona and goals still computed (TC-6)', () => {
    const x = learnerA();
    x.partB = { ...x.partB!, flagged: true, flags: ['attention:LP-Q1'] };
    const run = runEngine(x, ref, config);
    expect(run.part_b_used).toBe(false);
    expect(run.interests).toBeNull();
    const dir = run.persona.axes.find((a) => a.axis === 'direction')!;
    expect(dir.parameters.filter((p) => p.value === null).map((p) => p.id)).toEqual(['goal_clarity', 'interest_focus', 'goal_interest_agreement']);
    expect(dir.score).toBeCloseTo(1, 9); // only "one goal area" (+1) remains
    expect(run.goals.targets.every((g) => g.fit === 0)).toBe(true);
    expect(run.pathway.terms.length).toBeGreaterThan(0);
  });
  it('passing COM-3 raises its skills to 4 and recomputes term 2 with term 1 locked (TC-7)', () => {
    const x = { ...learnerA(), courses: [{ course_id: 'COM-3', status: 'passed' as const, source: 'course_assessment' as const }], locked_terms: [{ term_no: 1, course_id: 'COM-3' }], length_override: 12 as const };
    const run = runEngine(x, ref, config);
    expect(run.skill_levels['SK-COMM-007']).toEqual({ level: 4, source: 'course_assessment' });
    expect(run.pathway.terms[0]).toMatchObject({ course_id: 'COM-3', locked: true });
    expect(run.pathway.terms[1].course_id).toBe('AAI-1');
  });
  it('a failed locked term builds nothing and its course can be offered again', () => {
    const x = { ...learnerA(), courses: [{ course_id: 'COM-3', status: 'failed' as const, source: 'course_assessment' as const }], locked_terms: [{ term_no: 1, course_id: 'COM-3', outcome: 'failed' as const }], length_override: 12 as const };
    const run = runEngine(x, ref, config);
    expect(run.skill_levels['SK-COMM-007'].level).toBe(3);
    expect(run.pathway.terms[1].course_id).toBe('COM-3');
  });
  it('term 2 never repeats term 1 and never needs an unplanned course (FR-16), gaps never negative (FR-14)', () => {
    const orient = ref.career_goals.orientations.map((o) => o.id);
    for (const rl of referenceLearners()) {
      const run = runEngine(referenceInput(rl, orient), ref, config);
      const ids = run.pathway.terms.map((t) => t.course_id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const [i, t] of run.pathway.terms.entries()) {
        const course = ref.courses.courses.find((c) => c.course_id === t.course_id)!;
        const before = ids.slice(0, i);
        const placement = course.entry_ladder === 'ai' ? rl.input.ai_placement : rl.input.comm_placement;
        const done = rl.input.courses.filter((c) => c.status === 'passed').map((c) => c.course_id);
        expect(placement >= course.entry_level || course.prerequisites.hard.every((p) => before.includes(p) || done.includes(p))).toBe(true);
      }
      for (const n of run.needs) {
        expect(n.gap).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(n.required * 2)).toBe(true);
      }
    }
  });
});

describe('20 reference learners', () => {
  const orient = ref.career_goals.orientations.map((o) => o.id);
  for (const rl of referenceLearners()) {
    it(`${rl.id}: ${rl.label}`, () => {
      const input = referenceInput(rl, orient);
      const run = runEngine(input, ref, config);
      const fresh = runEngine(referenceInput(rl, orient), ref, config);
      expect(JSON.stringify(fresh)).toBe(JSON.stringify(run));
      if (rl.expected.persona_code) {
        // Designed far from every borderline, so no tie-breaker is needed
        expect(run.persona.tiebreak_axes).toEqual([]);
        expect(run.persona.persona_code).toBe(rl.expected.persona_code);
        expect(run.pathway.length_months).toBe(run.persona.preset && ref.personas.personas.find((p) => p.persona_code === rl.expected.persona_code)!.default_length === 12 ? 12 : 6);
      }
      if (rl.expected.part_b_used === false) expect(run.part_b_used).toBe(false);
      if (rl.expected.direction) expect(run.persona.persona_code[4]).toBe(rl.expected.direction);
      if (rl.expected.terms === 0) {
        expect(run.pathway.terms).toEqual([]);
        expect(run.build_elsewhere.length).toBeGreaterThan(0);
      }
      for (const t of run.pathway.terms) {
        expect(t.reason_skills.length).toBeGreaterThan(0);
        expect(t.goal_areas.length).toBeGreaterThan(0);
      }
      if (run.persona.preset === 'explore' && run.pathway.terms.length) expect(run.explore_option === null || !run.pathway.terms.some((t) => t.course_id === run.explore_option!.course_id)).toBe(true);
    });
  }
});

describe('course onboarding validation (FR-23, TC-8)', () => {
  const good: Course = {
    course_id: 'AAI-5', title: 'AI for Spreadsheets', series_id: 'AAI', nsqf_level: { min: 3, max: 3 }, level_out: 3,
    hours: { training: 15, assessment: 1, total: 16 }, entry_level: 1, entry_ladder: 'ai', prerequisites: { hard: ['AAI-1'], soft: [] }, eligibility: [],
    delivery: { modes: ['self_paced'], offline_ok: false, device_min: 'own_phone', languages: ['en'] },
    terminal_outcome: 'check spreadsheet totals with AI help and verify each number', status: 'active', version: 1,
    modules: [{ title: 'Checking numbers', outcomes: [{ lo_id: 'LO-1', text: 'Verify totals against the source', skill_ids: ['SK-THK-001', 'SK-ETH-001'] }] }],
    skills: [{ skill_id: 'SK-THK-001', level_out: 3, primary: true }, { skill_id: 'SK-ETH-001', level_out: 3, primary: true }, { skill_id: 'SK-DAI-002', level_out: 3, primary: false }],
  };
  const fails = (c: Course) => validateCourse(c, ref, { isNew: true }).checks.filter((x) => !x.ok).map((x) => x.id);
  it('accepts a complete template', () => expect(validateCourse(good, ref, { isNew: true }).ok).toBe(true));
  it.each<[number, (c: Course) => Course]>([
    [1, (c) => ({ ...c, course_id: 'AAI-1' })],
    [2, (c) => ({ ...c, level_out: 0.5 })],
    [3, (c) => ({ ...c, skills: [...c.skills, { skill_id: 'SK-XXX-999', level_out: 3, primary: false }] })],
    [4, (c) => ({ ...c, skills: c.skills.slice(0, 2) })],
    [5, (c) => ({ ...c, modules: [{ title: 'M', outcomes: [{ lo_id: 'LO-1', text: 'Too many', skill_ids: ['SK-THK-001', 'SK-ETH-001', 'SK-DAI-002', 'SK-DAI-003'] }] }] })],
    [6, (c) => ({ ...c, prerequisites: { hard: ['AAI-9'], soft: [] } })],
    [7, (c) => ({ ...c, entry_level: 3, skills: c.skills.map((s) => ({ ...s, level_out: 3 })) })],
    [8, (c) => ({ ...c, title: 'Guaranteed placement course' })],
  ])('check %i fails on a broken template', (id, breakIt) => expect(fails(breakIt(good))).toContain(id));
  it('detects a prerequisite loop (TC-8)', () => {
    const loopRef = { ...ref, courses: { ...ref.courses, courses: ref.courses.courses.map((c) => (c.course_id === 'AAI-1' ? { ...c, prerequisites: { hard: ['AAI-5'], soft: [] } } : c)) } };
    const r = validateCourse(good, loopRef, { isNew: true });
    expect(r.checks.find((c) => c.id === 6)!.messages).toContain('Prerequisites form a loop');
  });
  it('a new active course is scored with no code change', () => {
    const withNew = { ...ref, courses: { ...ref.courses, courses: [...ref.courses.courses, good] } };
    const x = { ...learnerA(), courses: [{ course_id: 'AAI-1', status: 'passed' as const, source: 'course_assessment' as const }] };
    const run = runEngine(x, withNew, config);
    expect(run.course_scores_by_term[0].scores.some((s) => s.course_id === 'AAI-5' && s.eligible)).toBe(true);
  });
});

describe('versioned config (TC-9)', () => {
  it('a changed weight changes new runs but old inputs replay identically with the old version', () => {
    const before = runEngine(learnerA(), ref, config);
    const changed = { ...config, version: 'v1.0.1', course: { ...config.course, weights: { ...config.course.weights, focus: { A: 0.5, U: 0.1, B: 0.3, F: 0.1 } } } };
    const after = runEngine(learnerA(), ref, changed);
    expect(after.versions.config).toBe('v1.0.1');
    expect(after.course_scores_by_term[0].scores[0].score).not.toBeCloseTo(before.course_scores_by_term[0].scores[0].score, 6);
    expect(JSON.stringify(runEngine(learnerA(), ref, config))).toBe(JSON.stringify(before));
  });
});
