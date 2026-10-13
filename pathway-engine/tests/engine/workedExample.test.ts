import { describe, expect, it } from 'vitest';
import { loadSeed } from '../../src/server/referenceData';
import { runEngine } from '../../src/engine';
import { learnerA } from '../helpers';

const { reference, config } = loadSeed();
const r2 = (x: number) => Math.round(x * 100) / 100;

describe('Section 20 worked example: Learner A', () => {
  const run = runEngine(learnerA(), reference, config);

  it('scores the four axes as in the specification', () => {
    const axes = Object.fromEntries(run.persona.axes.map((a) => [a.axis, a]));
    expect(r2(axes.direction.score)).toBe(0.55);
    expect(r2(axes.starting_point.score)).toBe(-0.25);
    expect(r2(axes.goal_horizon.base_score)).toBe(0.09);
    expect(r2(axes.goal_horizon.score)).toBe(0.27);
    expect(r2(axes.learning_drive.score)).toBe(0.28);
  });

  it('asks only the Goal Horizon tie-breaker and matches PER-CFLS', () => {
    expect(run.persona.tiebreak_axes).toEqual(['goal_horizon']);
    expect(run.persona.persona_code).toBe('PER-CFLS');
    expect(run.persona.name).toBe('The Climber');
    expect(r2(run.persona.confidence)).toBe(0.34);
    expect(run.persona.confidence_label).toBe('Medium');
    expect(run.persona.secondary_code).toBe('PER-CRLS');
  });

  it('ranks goal areas CG-02, CG-11, CG-01 with the documented scores', () => {
    const [a, b, c] = run.goals.targets;
    expect([a.goal_id, b.goal_id, c.goal_id]).toEqual(['CG-02', 'CG-11', 'CG-01']);
    expect(r2(a.score)).toBe(0.93);
    expect(r2(b.score)).toBe(0.34);
    expect(r2(c.score)).toBe(0.3);
    expect(r2(a.fit)).toBe(0.76);
    expect([a.weight, b.weight, c.weight]).toEqual([0.6, 0.25, 0.15]);
  });

  it('computes skill demand, required level and gap', () => {
    const n = Object.fromEntries(run.needs.map((x) => [x.skill_id, x]));
    const expected: [string, number, number, number, number][] = [
      ['SK-THK-001', 0.925, 4, 0, 4], ['SK-COMM-007', 0.875, 4.5, 3, 1.5], ['SK-ETH-001', 0.85, 4, 0, 4],
      ['SK-COMM-004', 0.75, 4, 3, 1], ['SK-DAI-002', 0.7, 3, 0, 3], ['SK-COMM-009', 0.375, 4, 3, 1],
      ['SK-DAI-006', 0.25, 3, 0, 3], ['SK-COMM-024', 0.15, 4, 3, 1], ['SK-ETH-004', 0.15, 4, 0, 4],
    ];
    for (const [id, d, req, now, gap] of expected) {
      expect(n[id].demand).toBeCloseTo(d, 6);
      expect([n[id].required, n[id].current, n[id].gap]).toEqual([req, now, gap]);
    }
    expect(run.needs).toHaveLength(9);
  });

  it('scores term 1: COM-3 0.90 ahead of AAI-1 0.87', () => {
    const t1 = run.course_scores_by_term[0].scores;
    const com3 = t1.find((s) => s.course_id === 'COM-3')!;
    const aai1 = t1.find((s) => s.course_id === 'AAI-1')!;
    expect(r2(com3.score)).toBe(0.9);
    expect([com3.A, com3.U, com3.B, com3.F]).toEqual([1, 0.5, 1, 1]);
    expect(r2(aai1.score)).toBe(0.87);
    expect(r2(aai1.A)).toBe(0.95);
    expect(t1.filter((s) => s.eligible).map((s) => s.course_id).sort()).toEqual(['AAI-1', 'COM-1', 'COM-2', 'COM-3']);
    expect(t1.find((s) => s.course_id === 'COM-1')!.recommended).toBe(false);
  });

  it('builds the 12-month pathway COM-3 then AAI-1 (TC-1)', () => {
    expect(run.pathway.length_months).toBe(12);
    expect(run.pathway.terms.map((t) => t.course_id)).toEqual(['COM-3', 'AAI-1']);
    expect(r2(run.pathway.terms[1].score)).toBe(0.9);
    const t2 = run.course_scores_by_term[1].scores;
    expect(r2(t2.find((s) => s.course_id === 'COM-4')!.score)).toBe(0.37);
    expect(run.pathway.terms[0].unlocks?.course_id).toBe('COM-4');
    expect(run.pathway.terms[1].unlocks?.course_id).toBe('AAI-2');
    expect(run.build_elsewhere.map((b) => b.skill_id)).toContain('SK-THK-001');
  });

  it('gives every recommended course a skill reason and a goal-area reason (FR-18)', () => {
    for (const t of run.pathway.terms) {
      expect(t.reason_skills.length).toBeGreaterThan(0);
      expect(t.goal_areas.length).toBeGreaterThan(0);
      expect(t.sentence).toMatch(/likely to be able to/);
    }
    expect(run.pathway.terms[0].reason_skills.slice(0, 2)).toEqual([
      { skill_id: 'SK-COMM-007', name: 'Report and business writing', from: 3, to: 4 },
      { skill_id: 'SK-COMM-004', name: 'Reading work documents (job cards, SOPs, reports)', from: 3, to: 4 },
    ]);
  });

  it('lists the skills gained and how each helps', () => {
    const gained = run.pathway.skills_gained;
    const verification = gained.find((g) => g.skill_id === 'SK-ETH-001')!;
    expect([verification.from, verification.to]).toEqual([0, 1]);
    expect(verification.helps.filter((h) => h.in_your_plan).map((h) => h.goal_id)).toEqual(['CG-02', 'CG-11']);
    expect(verification.helps[0].roles).toEqual(['Accounts assistant', 'Billing executive']);
  });

  it('is deterministic (TC-10)', () => {
    expect(JSON.stringify(runEngine(learnerA(), reference, config))).toBe(JSON.stringify(run));
  });

  it('switching to 6 months keeps only COM-3 (TC-2)', () => {
    const six = runEngine({ ...learnerA(), length_override: 6 }, reference, config);
    expect(six.pathway.terms.map((t) => t.course_id)).toEqual(['COM-3']);
  });
});
