import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { correctAnswer, learnerAPartB, partA, startServer, wrongAnswer } from './harness';

let s: Awaited<ReturnType<typeof startServer>>;
beforeAll(async () => { s = await startServer(); });
afterAll(async () => { await s.close(); });

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

/** Walks Learner A from consent to an accepted plan through the HTTP API. */
async function runLearnerA() {
  const created = await s.call('POST', '/learners', { name: 'Asha Kumari', dob: '2007-05-01', consents: { store_answers: true, take_assessment: true, share_with_mentor: true } });
  expect(created.status).toBe(201);
  const { learner_id: id, token } = created.body;
  const H = auth(token);

  for (const [item_id, answers] of Object.entries(partA)) {
    const r = await s.call('PATCH', `/learners/${id}`, { item_id, answers, ms_taken: 20_000 }, H);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
  }
  expect((await s.call('GET', `/learners/${id}`, undefined, H)).body.step).toBe('profile');

  for (const [item_id, value] of Object.entries(learnerAPartB)) {
    expect((await s.call('POST', `/learners/${id}/assessment/B/responses`, { item_id, value, ms_taken: 15_000 }, H)).status).toBe(200);
  }
  const b = await s.call('POST', `/learners/${id}/assessment/B`, {}, H);
  expect(b.body).toEqual({ flagged: false });

  // AI check: fail level 1 -> placement 0
  let next = await s.call('GET', `/learners/${id}/skill-check/next?series=ai`, undefined, H);
  next = await s.call('POST', `/learners/${id}/skill-check/answers`, { series: 'ai', item_id: next.body.item.item_id, answer: wrongAnswer(next.body.item.item_id), ms_taken: 30_000 }, H);
  next = await s.call('POST', `/learners/${id}/skill-check/answers`, { series: 'ai', item_id: next.body.item.item_id, answer: correctAnswer(next.body.item.item_id), ms_taken: 30_000 }, H);
  expect(next.body.done).toBe(true);

  // Communication: UG starts at band 3; fail it, step down to band 2 and pass -> placement 3
  const seen: string[] = [];
  next = await s.call('GET', `/learners/${id}/skill-check/next?series=comm`, undefined, H);
  while (!next.body.done) {
    const itemId: string = next.body.item.item_id;
    seen.push(itemId);
    const answer = itemId.startsWith('SC-COM-3') ? wrongAnswer(itemId) : correctAnswer(itemId);
    next = await s.call('POST', `/learners/${id}/skill-check/answers`, { series: 'comm', item_id: itemId, answer, ms_taken: 40_000 }, H);
  }
  expect(seen.map((x) => x.slice(0, 8))).toEqual(['SC-COM-3', 'SC-COM-3', 'SC-COM-3', 'SC-COM-2', 'SC-COM-2', 'SC-COM-2']);

  const d = await s.call('POST', `/learners/${id}/assessment/D`, { goal_areas: ['CG-02'], main_goal: 'job_1_2y', earning_need: '1_2y', mobility: 'state', note: 'Evening classes only', ms_taken: 60_000 }, H);
  expect(d.status).toBe(200);
  return { id, H };
}

describe('learner journey through the API', () => {
  it('reproduces the worked example end to end and accepts the plan', async () => {
    const { id, H } = await runLearnerA();
    const persona = await s.call('POST', `/learners/${id}/persona`, {}, H);
    expect(persona.body.tiebreak_needed.map((t: { axis: string }) => t.axis)).toEqual(['goal_horizon']);
    // Pathway before the tie-breaker is refused with 422
    expect((await s.call('POST', `/learners/${id}/pathway`, {}, H)).status).toBe(422);
    const tb = await s.call('POST', `/learners/${id}/persona/tiebreak`, { axis: 'goal_horizon', answer: 'qualified' }, H);
    expect(tb.body.tiebreak_needed).toEqual([]);

    const plan = await s.call('POST', `/learners/${id}/pathway`, {}, H);
    expect(plan.status, JSON.stringify(plan.body)).toBe(200);
    expect(plan.body.persona.code).toBe('PER-CFLS');
    expect(plan.body.goals.map((g: { goal_id: string }) => g.goal_id)).toEqual(['CG-02', 'CG-11', 'CG-01']);
    expect(plan.body.pathway.terms.map((t: { course_id: string }) => t.course_id)).toEqual(['COM-3', 'AAI-1']);
    expect(plan.body.pathway.skills_gained.length).toBeGreaterThan(5);
    // Learners never see habit scores or engine numbers
    const text = JSON.stringify(plan.body);
    expect(text).not.toMatch(/self_discipline|learning_independence|axis_|a_raw/);
    for (const t of plan.body.pathway.terms) expect(t.score).toBeUndefined();

    // Hindi: same plan, rendered in Hindi; the communication tasks stay in English
    const hi = await s.call('GET', `/learners/${id}/results`, undefined, { ...H, 'x-lang': 'hi' });
    expect(hi.body.persona.name).toBe('पर्वतारोही');
    expect(hi.body.pathway.terms.map((t: { course_id: string }) => t.course_id)).toEqual(['COM-3', 'AAI-1']);
    expect(hi.body.pathway.terms[0].title).toBe('सुपरवाइज़री संचार कौशल');
    expect(hi.body.pathway.terms[0].sentence).toMatch(/^सुपरवाइज़री संचार कौशल के बाद, आप शायद/);
    expect(hi.body.pathway.summary).toMatch(/^अगले 12 महीनों में/);
    const itemsHi = await s.call('GET', '/assessment/items?part=B', undefined, { 'x-lang': 'hi' });
    expect(itemsHi.body.items[0].text).toMatch(/[\u0900-\u097F]/);
    const courseHi = await s.call('GET', '/courses/AAI-1', undefined, { 'x-lang': 'hi' });
    expect(courseHi.body.title).toBe('AI के पहले कदम: इस्तेमाल करें और जाँचें');

    const six = await s.call('POST', `/learners/${id}/pathway`, { length_months: 6 }, H);
    expect(six.body.pathway.terms.map((t: { course_id: string }) => t.course_id)).toEqual(['COM-3']);
    const twelve = await s.call('POST', `/learners/${id}/pathway`, { length_months: 12 }, H);
    const accepted = await s.call('POST', `/pathways/${twelve.body.pathway_id}/accept`, {}, H);
    expect(accepted.body.status).toBe('accepted');
    expect((await s.call('GET', `/learners/${id}`, undefined, H)).body.step).toBe('dashboard');

    // Course platform: start COM-3 (locks term 1), then pass it (TC-7)
    const P = { 'x-platform-key': 'platform-key' };
    expect((await s.call('POST', `/learners/${id}/events`, { type: 'course_started', course_id: 'COM-3', date: '2026-11-01' })).status).toBe(401);
    await s.call('POST', `/learners/${id}/events`, { type: 'course_started', course_id: 'COM-3', date: '2026-11-01' }, P);
    // A locked term cannot be removed (FR-20 -> 409); shrinking 12 -> 6 keeps term 1, so it is allowed
    const passed = await s.call('POST', `/learners/${id}/events`, { type: 'course_passed', course_id: 'COM-3' }, P);
    expect(passed.body.replanned).toBe(true);
    const after = await s.call('GET', `/learners/${id}/results`, undefined, H);
    expect(after.body.pathway.terms[0]).toMatchObject({ course_id: 'COM-3', locked: true, status: 'passed', starts_on: '2026-11-01', ends_on: '2027-05-02' });
    expect(after.body.pathway.terms[1].course_id).toBe('AAI-1');

    // Mentor sees every score; replaying the run gives an identical result (FR-22, FR-26)
    const staff = await s.call('POST', '/staff/session', { role: 'mentor', code: 'mentor-code' });
    const M = auth(staff.body.token);
    const detail = await s.call('GET', `/mentor/learners/${id}`, undefined, M);
    expect(detail.body.part_b.scales.self_discipline).toBeCloseTo(3.8, 6);
    expect(detail.body.learner_note).toBe('Evening classes only');
    expect(detail.body.run.output.course_scores_by_term[0].scores[0].A).toBeDefined();
    const replay = await s.call('POST', `/runs/${detail.body.run.run_id}/replay`, {}, M);
    expect(replay.body.identical).toBe(true);
    // Learners cannot use staff endpoints
    expect((await s.call('GET', `/mentor/learners/${id}`, undefined, H)).status).toBe(401);
  });

  it('refuses to compute until every part is complete (FR-9)', async () => {
    const c = await s.call('POST', '/learners', { name: 'Ravi', dob: '2004-01-01', consents: { store_answers: true, take_assessment: true } });
    const r = await s.call('POST', `/learners/${c.body.learner_id}/persona`, {}, auth(c.body.token));
    expect(r.status).toBe(422);
    expect(r.body.details.missing_part).toBe('A');
  });

  it('stops under-age learners and requires the core consents (FR-1)', async () => {
    const young = await s.call('POST', '/learners', { name: 'Kid', dob: '2012-01-01', consents: { store_answers: true, take_assessment: true } });
    expect(young.status).toBe(400);
    expect(young.body.error).toBe('under_age');
    const noConsent = await s.call('POST', '/learners', { name: 'Adult', dob: '2000-01-01', consents: { store_answers: true, take_assessment: false } });
    expect(noConsent.body.error).toBe('consent_required');
  });

  it('asks for a guardian under 17 and hides results until consent (451)', async () => {
    const noAnswer = await s.call('POST', '/learners', { name: 'Meena', dob: '2010-06-01', consents: { store_answers: true, take_assessment: true } });
    expect(noAnswer.status).toBe(400);
    const pending = await s.call('POST', '/learners', { name: 'Meena', dob: '2010-06-01', consents: { store_answers: true, take_assessment: true }, guardian: { present: false } });
    expect(pending.body.guardian_status).toBe('pending');
    const H = auth(pending.body.token);
    expect((await s.call('GET', `/learners/${pending.body.learner_id}/results`, undefined, H)).status).toBe(451);
    const given = await s.call('POST', `/learners/${pending.body.learner_id}/guardian-consent`, { name: 'Sunita Devi', relation: 'mother', consent: true }, H);
    expect(given.body.guardian_status).toBe('given');
    const seventeen = await s.call('POST', '/learners', { name: 'Arjun', dob: '2009-01-01', consents: { store_answers: true, take_assessment: true } });
    expect(seventeen.body.guardian_status).toBe('not_needed');
  });

  it('keeps one learner out of another learner\'s records', async () => {
    const a = await s.call('POST', '/learners', { name: 'One', dob: '2001-01-01', consents: { store_answers: true, take_assessment: true } });
    const b = await s.call('POST', '/learners', { name: 'Two', dob: '2001-01-01', consents: { store_answers: true, take_assessment: true } });
    expect((await s.call('GET', `/learners/${b.body.learner_id}`, undefined, auth(a.body.token))).status).toBe(401);
  });

  it('flags a straight-lined, rushed learning profile (FR-5)', async () => {
    const c = await s.call('POST', '/learners', { name: 'Fast', dob: '2001-01-01', consents: { store_answers: true, take_assessment: true } });
    const H = auth(c.body.token);
    for (const item_id of Object.keys(learnerAPartB)) await s.call('POST', `/learners/${c.body.learner_id}/assessment/B/responses`, { item_id, value: 4, ms_taken: 1000 }, H);
    const r = await s.call('POST', `/learners/${c.body.learner_id}/assessment/B`, {}, H);
    expect(r.body.flagged).toBe(true);
  });
});
