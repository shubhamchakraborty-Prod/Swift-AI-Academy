import { describe, expect, it } from 'vitest';
import { loadSeed } from '../../src/server/referenceData';
import { partBFromScaleMeans, runEngine, type EngineInput } from '../../src/engine';
import { ORIENTATIONS } from '../helpers';

const { reference: ref, config } = loadSeed();

function learner(p: Partial<EngineInput['profile']>, o: Partial<EngineInput> & { means: Parameters<typeof partBFromScaleMeans>[0] }): EngineInput {
  return {
    profile: { age: 22, education_stage: 'graduate', time_left: 'finished', field_of_study: 'other', certificates: [], work_experience: 'none', role_level: 'none', device: 'own_phone', internet: 'reliable', weekly_hours: '6_to_8', ...p },
    partB: partBFromScaleMeans(o.means, ORIENTATIONS),
    ai_placement: o.ai_placement ?? 0,
    comm_placement: o.comm_placement ?? 3,
    diligence: true,
    goals: o.goals ?? { goal_areas: [], main_goal: 'job_1_2y', earning_need: '1_2y', mobility: 'state' },
    tiebreaks: o.tiebreaks ?? {},
    courses: o.courses ?? [],
  };
}
const habits = { self_discipline: 3.6, learning_independence: 3.5, learning_motivation: 4, conf_english: 3.3, conf_tech: 2.7 };
const summary = (x: EngineInput) => {
  const tb = { ...x.tiebreaks };
  let run = runEngine(x, ref, config);
  for (const a of run.persona.tiebreak_pending) tb[a] = 1; // answer any tie-breaker towards the positive pole
  run = runEngine({ ...x, tiebreaks: tb }, ref, config);
  return run;
};
const eligibleOnly = (run: ReturnType<typeof runEngine>) => run.pathway.terms.every((t, i) => run.course_scores_by_term[i].scores.find((s) => s.course_id === t.course_id)!.eligible);

describe('representative learners from the brief', () => {
  it('BA History graduate interested in technology: not rejected from AI courses, and gaps the catalogue cannot close are flagged', () => {
    const base = learner({ field_of_study: 'ba' }, {
      means: { people: 3.5, data: 3.0, ideas: 4.5, things: 2.5, goal_clarity: 4, ...habits },
      ai_placement: 0, comm_placement: 4, goals: { goal_areas: ['CG-10', 'CG-12'], main_goal: 'job_1_2y', earning_need: '1_2y', mobility: 'india' },
    });
    const run = summary({ ...base, length_override: 12 });
    expect(run.goals.targets[0].goal_id).toBe('CG-10');
    expect(run.course_scores_by_term[0].scores.find((s) => s.course_id === 'AAI-1')!.recommended).toBe(true);
    expect(run.pathway.terms.map((t) => t.course_id)).toContain('AAI-1');
    expect(eligibleOnly(run)).toBe(true);
    // Software, Bots & Apps needs bot-building skills; BOT-1 is still a draft, so they are listed honestly
    expect(run.build_elsewhere.map((b) => b.skill_id)).toContain('SK-BLD-001');

    // Activating BOT-1 (with hours confirmed) changes this learner's plan with no code change
    const withBot = { ...ref, courses: { ...ref.courses, courses: ref.courses.courses.map((c) => (c.course_id === 'BOT-1' ? { ...c, status: 'active' as const, hours: { training: 40, assessment: 4, total: 44 } } : c)) } };
    const tb = Object.fromEntries(runEngine({ ...base, length_override: 12 }, ref, config).persona.tiebreak_pending.map((a) => [a, 1]));
    const botRun = runEngine({ ...base, length_override: 12, tiebreaks: tb }, withBot, config);
    const aai1 = botRun.pathway.terms.find((t) => t.course_id === 'AAI-1')!;
    expect(aai1.unlocks?.course_id).toBe('BOT-1');
    expect(botRun.build_elsewhere.map((b) => b.skill_id)).not.toContain('SK-BLD-001');
  });

  it('Engineering graduate with strong AI skills: starts at AAI-4, lower AI levels are skipped', () => {
    const run = summary(learner({ field_of_study: 'other', device: 'phone_and_laptop', weekly_hours: 'over_8' }, {
      means: { people: 2.8, data: 4.0, ideas: 4.6, things: 3.8, goal_clarity: 4.5, ...habits, conf_tech: 4.5 },
      ai_placement: 3, comm_placement: 5, goals: { goal_areas: ['CG-10'], main_goal: 'job_6m', earning_need: 'within_6m', mobility: 'india' },
    }));
    const ids = run.pathway.terms.map((t) => t.course_id);
    expect(ids[0]).toBe('AAI-4');
    for (const low of ['AAI-1', 'AAI-2', 'AAI-3']) expect(ids).not.toContain(low);
    expect(run.persona.persona_code.slice(4, 6)).toBe('CR');
  });

  it('ITI Electrician trainee: skilled trades first, a trade communication course at the right level', () => {
    const run = summary(learner({ education_stage: 'iti_2', field_of_study: 'iti_electrical_mechanical', time_left: 'about_1', device: 'shared_phone' }, {
      means: { people: 2.8, data: 3.2, ideas: 2.5, things: 4.7, goal_clarity: 4.2, ...habits },
      ai_placement: 0, comm_placement: 2, goals: { goal_areas: ['CG-07'], main_goal: 'job_6m', earning_need: 'within_6m', mobility: 'district' },
    }));
    expect(run.goals.targets[0].goal_id).toBe('CG-07');
    expect(run.goals.targets[0].reasons).toEqual(expect.arrayContaining(['choice', 'interests', 'studies']));
    expect(run.pathway.terms[0].course_id).toBe('COM-2');
    expect(run.pathway.length_months).toBe(6);
    expect(eligibleOnly(run)).toBe(true);
  });

  it('Commerce learner moving towards data work: Data & Analytics leads; COM-5 and above stay out of reach', () => {
    const run = summary(learner({ field_of_study: 'bcom', education_stage: 'ug_3', time_left: 'final_year' }, {
      means: { people: 3.0, data: 4.6, ideas: 3.8, things: 2.2, goal_clarity: 3.8, ...habits },
      ai_placement: 1, comm_placement: 3, goals: { goal_areas: ['CG-11', 'CG-02'], main_goal: 'job_1_2y', earning_need: '6_12m', mobility: 'state' },
    }));
    expect(run.goals.targets.map((g) => g.goal_id).slice(0, 2)).toEqual(['CG-11', 'CG-02']);
    const ids = run.pathway.terms.map((t) => t.course_id);
    expect(ids.some((c) => c.startsWith('AAI'))).toBe(true);
    expect(ids).not.toContain('AAI-1'); // placement 1 already reaches AAI-1's output level
    expect(run.course_scores_by_term[0].scores.find((s) => s.course_id === 'COM-5')!.eligible).toBe(false);
  });

  it('learner with limited digital exposure and Not sure yet: broad Explore plan with courses at entry level', () => {
    const run = summary(learner({ education_stage: 'class_12', device: 'shared_phone', internet: 'patchy', weekly_hours: 'under_3', time_left: 'finished' }, {
      means: { people: 3.2, data: 3.1, ideas: 3.0, things: 3.1, goal_clarity: 2.2, self_discipline: 3, learning_independence: 2.5, learning_motivation: 3.5, conf_english: 2.3, conf_tech: 2 },
      ai_placement: 0, comm_placement: 1, goals: { goal_areas: [], main_goal: 'not_sure', earning_need: '6_12m', mobility: 'district' },
    }));
    expect(run.persona.persona_code[4]).toBe('E');
    expect(run.persona.preset).toBe('explore');
    expect(run.pathway.terms[0].course_id).toMatch(/^(AAI-1|COM-1)$/);
  });
});
