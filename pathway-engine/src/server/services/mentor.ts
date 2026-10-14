import type { Ctx } from '../context';
import { newId } from '../crypto';
import { HttpError, notFound } from '../errors';
import type { EngineRun, PartBScores } from '../../engine';
import { partBScores, placement } from './assessment';
import { currentPathway, progress, runFor, type TermRow } from './engineRunner';
import type { LearnerRow } from './learners';

/** M01: learners who agreed to share results with their mentor. */
export async function mentorList(ctx: Ctx) {
  const rows = await ctx.db.query<LearnerRow>(`select * from learner where status = 'active' and share_with_mentor order by created_at desc`);
  return Promise.all(rows.map(async (l) => {
    const p = await currentPathway(ctx.db, l.learner_id);
    const pr = await progress(ctx, l.learner_id);
    return {
      learner_id: l.learner_id,
      name: l.name_enc ? ctx.cipher.decrypt(l.name_enc) : '',
      age: l.age,
      step: pr.step,
      guardian_status: l.guardian_status,
      persona_code: p?.persona_code ?? null,
      pathway_status: p?.status ?? null,
      created_at: l.created_at,
    };
  }));
}

/** M02: every score behind the plan. */
export async function mentorDetail(ctx: Ctx, learnerId: string) {
  const [l] = await ctx.db.query<LearnerRow>(`select * from learner where learner_id = $1 and status = 'active'`, [learnerId]);
  if (!l) throw notFound('Learner not found');
  if (!l.share_with_mentor) throw new HttpError(451, 'consent_missing', 'This learner has not agreed to share results with mentors');
  const pathway = await currentPathway(ctx.db, learnerId);
  const run = pathway ? await runFor(ctx, pathway.run_id) : null;
  const terms = pathway ? await ctx.db.query<TermRow>('select * from pathway_term where pathway_id = $1 order by term_no', [pathway.pathway_id]) : [];
  const partB: PartBScores | null = await partBScores(ctx.db, learnerId);
  const ai = await placement(ctx.db, learnerId, 'C_AI');
  const comm = await placement(ctx.db, learnerId, 'C_COMM');
  const notes = await ctx.db.query<{ note_id: string; author: string; text_enc: string; at: Date }>('select * from mentor_note where learner_id = $1 order by at desc', [learnerId]);
  const events = await ctx.db.query('select type, payload, actor, at from event_log where learner_id = $1 order by at desc limit 50', [learnerId]);
  const output: EngineRun | null = run?.output ?? null;
  return {
    learner_id: learnerId,
    name: l.name_enc ? ctx.cipher.decrypt(l.name_enc) : '',
    age: l.age,
    guardian_status: l.guardian_status,
    profile: l.profile,
    goals: l.goals,
    learner_note: l.note_enc ? ctx.cipher.decrypt(l.note_enc) : null,
    persona_feedback: l.persona_feedback,
    progress: await progress(ctx, learnerId),
    part_b: partB,
    placements: { ai, comm },
    confidence_check: partB && !partB.flagged && ai !== null && comm !== null
      ? { english: { confidence: partB.scales.conf_english, placement: comm }, tech_ai: { confidence: partB.scales.conf_tech, placement: ai }, bands_status: 'Bands are set after the pilot (open item 8). Raw values shown.' }
      : null,
    run: output && run ? { run_id: pathway!.run_id, created_at: run.created_at, trigger: run.trigger, config_version: run.config_version, reference_version: run.reference_version, inputs: run.inputs, output } : null,
    pathway: pathway ? { ...pathway, terms } : null,
    notes: notes.map((n) => ({ note_id: n.note_id, author: n.author, text: ctx.cipher.decrypt(n.text_enc), at: n.at })),
    events,
  };
}

export async function addMentorNote(ctx: Ctx, learnerId: string, text: string) {
  await mentorDetail(ctx, learnerId); // access check
  await ctx.db.query('insert into mentor_note (note_id, learner_id, author, text_enc) values ($1, $2, $3, $4)', [newId('N'), learnerId, 'mentor', ctx.cipher.encrypt(text)]);
}
