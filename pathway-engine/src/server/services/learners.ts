/**
 * Learner Service (Step 1-2): creates the learner with consent per purpose, handles the
 * guardian step for minors (age < config.consent.guardian_required_below_age), and validates Part A answers
 * against the item bank. Personal fields are encrypted before they reach the database.
 */
import { z } from 'zod';
import type { Ctx } from '../context';
import { logEvent } from '../context';
import { hashToken, newId, newToken } from '../crypto';
import { badRequest, HttpError, notFound } from '../errors';
import type { ProfileItem, ReferenceData } from '../../engine/types';

export interface LearnerRow {
  learner_id: string;
  token_hash: string;
  name_enc: string | null;
  dob_enc: string | null;
  age: number;
  guardian_status: 'not_needed' | 'given' | 'pending';
  profile: Record<string, unknown>;
  goals: Record<string, unknown> | null;
  note_enc: string | null;
  share_with_mentor: boolean;
  persona_feedback: string | null;
  status: string;
  created_at: Date;
}

export function ageOn(dob: string, today: Date): number {
  const [y, m, d] = dob.split('-').map(Number);
  let age = today.getUTCFullYear() - y;
  const beforeBirthday = today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

const guardianSchema = z.object({
  present: z.boolean(),
  name: z.string().trim().min(2).max(100).optional(),
  relation: z.enum(['mother', 'father', 'legal_guardian', 'other_family']).optional(),
  consent: z.boolean().optional(),
});

export const createLearnerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(100),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date of birth'),
  consents: z.record(z.boolean()),
  guardian: guardianSchema.optional(),
  lang: z.enum(['en', 'hi']).default('en'),
});

/** Step 1: create the learner and store one consent row per purpose. */
export async function createLearner(ctx: Ctx, body: z.infer<typeof createLearnerSchema>) {
  const { config } = await ctx.versions.active();
  const dob = new Date(`${body.dob}T00:00:00Z`);
  if (Number.isNaN(dob.getTime()) || dob > ctx.now()) throw badRequest('Enter a valid date of birth', { field: 'dob' });
  const age = ageOn(body.dob, ctx.now());
  if (age < config.consent.min_age) {
    throw new HttpError(400, 'under_age', `This assessment is for learners aged ${config.consent.min_age} and above.`, { field: 'dob' });
  }
  for (const p of config.consent.purposes) {
    if (p.required && !body.consents[p.id]) throw new HttpError(400, 'consent_required', 'This consent is needed to build your plan.', { field: p.id });
  }
  const needsGuardian = age < config.consent.guardian_required_below_age;
  let guardian_status: LearnerRow['guardian_status'] = 'not_needed';
  if (needsGuardian) {
    const g = body.guardian;
    if (!g) throw badRequest('Tell us whether your parent or guardian is with you', { field: 'guardian' });
    if (g.present) {
      if (!g.name || !g.relation || !g.consent) throw badRequest('Your parent or guardian needs to add their name and give consent', { field: 'guardian' });
      guardian_status = 'given';
    } else guardian_status = 'pending';
  }
  const learner_id = newId('L');
  const token = newToken();
  await ctx.db.tx(async (q) => {
    await q.query(
      `insert into learner (learner_id, token_hash, name_enc, dob_enc, age, guardian_status, share_with_mentor, profile)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [learner_id, hashToken(token), ctx.cipher.encrypt(body.name), ctx.cipher.encrypt(body.dob), age, guardian_status, Boolean(body.consents.share_with_mentor), JSON.stringify({ learning_ui_language: body.lang })],
    );
    for (const p of config.consent.purposes) {
      const byGuardian = needsGuardian && guardian_status === 'given';
      await q.query(
        'insert into learner_consent (learner_id, purpose, granted, by_guardian, guardian_name_enc, guardian_relation) values ($1, $2, $3, $4, $5, $6)',
        [learner_id, p.id, Boolean(body.consents[p.id]), byGuardian, byGuardian ? ctx.cipher.encrypt(body.guardian!.name!) : null, byGuardian ? body.guardian!.relation : null],
      );
    }
    await logEvent(q, { id: newId('E'), learner_id, type: 'learner_created', payload: { age, guardian_status }, actor: 'learner' });
  });
  return { learner_id, token, guardian_status };
}

export const guardianConsentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  relation: z.enum(['mother', 'father', 'legal_guardian', 'other_family']),
  consent: z.literal(true),
});

export async function giveGuardianConsent(ctx: Ctx, learnerId: string, body: z.infer<typeof guardianConsentSchema>) {
  const learner = await getLearner(ctx, learnerId);
  if (learner.guardian_status !== 'pending') throw new HttpError(409, 'not_pending', 'Guardian consent is not pending');
  await ctx.db.tx(async (q) => {
    await q.query(`update learner set guardian_status = 'given', updated_at = now() where learner_id = $1`, [learnerId]);
    await q.query(`update learner_consent set by_guardian = true, guardian_name_enc = $2, guardian_relation = $3, at = now() where learner_id = $1`, [learnerId, ctx.cipher.encrypt(body.name), body.relation]);
    await logEvent(q, { id: newId('E'), learner_id: learnerId, type: 'guardian_consent', payload: { relation: body.relation }, actor: 'guardian' });
  });
}

export async function getLearner(ctx: Ctx, learnerId: string): Promise<LearnerRow> {
  const [row] = await ctx.db.query<LearnerRow>(`select * from learner where learner_id = $1 and status = 'active'`, [learnerId]);
  if (!row) throw notFound('Learner not found');
  return row;
}

export async function learnerIdForToken(ctx: Ctx, token: string): Promise<string | null> {
  const [row] = await ctx.db.query<{ learner_id: string }>(`select learner_id from learner where token_hash = $1 and status = 'active'`, [hashToken(token)]);
  return row?.learner_id ?? null;
}

/** Part A item list with options filled from the catalogue (fields of study, courses). */
export function resolvePartA(ref: ReferenceData): ProfileItem[] {
  return ref.items.part_a
    .filter((i) => i.status === 'active')
    .map((i) => {
      if (i.options_source === 'fields') return { ...i, options: ref.fields.fields.map((f) => ({ value: f.field_id, label_en: f.name })) };
      if (i.options_source === 'courses') {
        return { ...i, options: ref.courses.courses.filter((c) => c.status === 'active').map((c) => ({ value: c.course_id, label_en: `${c.course_id} ${c.title}` })) };
      }
      return i;
    });
}

/** Validate one Part A answer against the item bank and return the profile fields to store. */
export function validatePartA(item: ProfileItem, ref: ReferenceData, answer: Record<string, unknown>): Record<string, unknown> {
  const fail = (msg: string) => { throw badRequest(msg, { item_id: item.item_id }); };
  const values = (item.options ?? []).map((o) => o.value);
  const v = answer[item.field];
  switch (item.type) {
    case 'single':
      if (v === null && !item.required) return { [item.field]: null };
      if (typeof v !== 'string' || !values.includes(v)) fail('Choose one of the options');
      return { [item.field]: v };
    case 'multi': {
      if (!Array.isArray(v) || !v.length) fail('Choose at least one option, or None');
      const arr = v as string[];
      const none = item.none_option?.value;
      if (none && arr.includes(none) && arr.length > 1) fail('None cannot be combined with other options');
      if (arr.some((x) => x !== none && !values.includes(x))) fail('Unknown option');
      return { [item.field]: [...new Set(arr)].sort() };
    }
    case 'state_district': {
      const loc = v as { state?: unknown; district?: unknown } | undefined;
      if (!loc || typeof loc.state !== 'string' || !ref.items.states.includes(loc.state)) fail('Choose your state');
      const district = typeof loc!.district === 'string' ? loc!.district.trim() : '';
      if (district.length < 2 || district.length > 80) fail('Enter your district or city');
      return { [item.field]: { state: loc!.state, district } };
    }
    case 'experience': {
      if (typeof v !== 'string' || !values.includes(v)) fail('Choose one of the options');
      const sub = item.sub_question!;
      if (sub.skip_when.includes(v as string)) return { [item.field]: v, [sub.field]: sub.value_when_skipped };
      const role = answer[sub.field];
      if (typeof role !== 'string' || !sub.options.some((o) => o.value === role)) fail('Choose your highest role');
      return { [item.field]: v, [sub.field]: role };
    }
    default:
      return fail('Unsupported item');
  }
}
