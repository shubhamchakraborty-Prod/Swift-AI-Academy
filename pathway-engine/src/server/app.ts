import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ZodError, z } from 'zod';
import type { Ctx } from './context';
import { safeEqual } from './crypto';
import { HttpError } from './errors';
import { createLearner, createLearnerSchema, getLearner, giveGuardianConsent, guardianConsentSchema, learnerIdForToken } from './services/learners';
import {
  answerPartA, answerPartB, answerSkillItem, itemsForPart, nextSkillItem, partAAnswerSchema, partBAnswerSchema, partDSchema,
  skillAnswerSchema, startPartBRetake, submitPartB, submitPartD,
} from './services/assessment';
import { acceptPathway, answerTiebreak, computePersona, currentPathway, planPathway, progress, replayRun } from './services/engineRunner';
import { courseDetail, eventSchema, handleEvent, learnerResults } from './services/results';
import { addMentorNote, mentorDetail, mentorList } from './services/mentor';
import {
  activateDraft, activateVersion, configChangeSchema, createConfigVersion, listCourses, listVersions, referenceOverview,
  saveCourseDraft, simulateConfig, simulateDraft, validateDraft,
} from './services/admin';
import { deleteLearner } from './services/privacy';
import type { EngineConfig } from '../engine';

type Handler = (req: Request, res: Response) => Promise<unknown>;
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).then((out) => { if (!res.headersSent) res.json(out ?? { ok: true }); }, next);

const bearer = (req: Request) => (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();

export function createApp(ctx: Ctx) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  // ----- auth -----
  /** A learner may only reach their own records. */
  const learnerAuth = async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const id = await learnerIdForToken(ctx, bearer(req));
      const target = req.params.id ?? id;
      if (!id || id !== target) throw new HttpError(401, 'unauthorised', 'Please start again from the welcome screen');
      res_locals(req).learnerId = id;
      next();
    } catch (e) { next(e); }
  };
  const staffAuth = (role: 'mentor' | 'admin') => (req: Request, _res: Response, next: NextFunction) => {
    const r = ctx.staff.verify(bearer(req));
    if (!r || (role === 'admin' && r !== 'admin') || (role === 'mentor' && r !== 'mentor' && r !== 'admin')) return next(new HttpError(401, 'unauthorised', 'Sign in again'));
    next();
  };
  const platformAuth = (req: Request, _res: Response, next: NextFunction) => {
    const key = String(req.headers['x-platform-key'] ?? '');
    if (!key || !safeEqual(key, ctx.settings.platformKey)) return next(new HttpError(401, 'unauthorised', 'Invalid platform key'));
    next();
  };

  const v1 = express.Router();

  // ----- public -----
  v1.get('/meta', h(async () => {
    const { ref, config } = await ctx.versions.active();
    return {
      consent: config.consent,
      reference_version: ref.version,
      config_version: config.version,
      guardian_relations: [
        { value: 'mother', label: 'Mother' }, { value: 'father', label: 'Father' },
        { value: 'legal_guardian', label: 'Legal guardian' }, { value: 'other_family', label: 'Other family member' },
      ],
    };
  }));
  v1.get('/assessment/items', h(async (req) => itemsForPart(ctx, String(req.query.part ?? ''))));
  v1.get('/courses/:courseId', h(async (req) => courseDetail(ctx, req.params.courseId)));

  // ----- learner -----
  v1.post('/learners', h(async (req, res) => {
    const out = await createLearner(ctx, createLearnerSchema.parse(req.body));
    res.status(201);
    return out;
  }));
  v1.get('/learners/me', learnerAuth, h(async (req) => progress(ctx, res_locals(req).learnerId)));
  v1.get('/learners/:id', learnerAuth, h(async (req) => progress(ctx, req.params.id)));
  v1.patch('/learners/:id', learnerAuth, h(async (req) => answerPartA(ctx, req.params.id, partAAnswerSchema.parse(req.body))));
  v1.post('/learners/:id/guardian-consent', learnerAuth, h(async (req) => {
    await giveGuardianConsent(ctx, req.params.id, guardianConsentSchema.parse(req.body));
    return progress(ctx, req.params.id);
  }));
  v1.post('/learners/:id/assessment/B/responses', learnerAuth, h(async (req) => answerPartB(ctx, req.params.id, partBAnswerSchema.parse(req.body))));
  v1.post('/learners/:id/assessment/B', learnerAuth, h(async (req) => submitPartB(ctx, req.params.id)));
  v1.post('/learners/:id/assessment/B/retake', learnerAuth, h(async (req) => startPartBRetake(ctx, req.params.id)));
  v1.get('/learners/:id/skill-check/next', learnerAuth, h(async (req) => nextSkillItem(ctx, req.params.id, z.enum(['ai', 'comm']).parse(req.query.series))));
  v1.post('/learners/:id/skill-check/answers', learnerAuth, h(async (req) => answerSkillItem(ctx, req.params.id, skillAnswerSchema.parse(req.body))));
  v1.post('/learners/:id/assessment/D', learnerAuth, h(async (req) => {
    const id = req.params.id;
    const { changed } = await submitPartD(ctx, id, partDSchema.parse(req.body));
    const current = await currentPathway(ctx.db, id);
    // Goals changed after a plan exists: recompute persona and goal areas, keep started terms (Step 14).
    if (changed && current) {
      const { tiebreak_needed } = await computePersona(ctx, id);
      if (!tiebreak_needed.length) await planPathway(ctx, id, { trigger: 'goals_changed', actor: 'learner', status: current.status === 'proposed' ? 'proposed' : 'accepted' });
      return { replanned: !tiebreak_needed.length, tiebreak_needed };
    }
    return { replanned: false, tiebreak_needed: [] };
  }));
  v1.post('/learners/:id/persona', learnerAuth, h(async (req) => computePersona(ctx, req.params.id)));
  v1.post('/learners/:id/persona/tiebreak', learnerAuth, h(async (req) => answerTiebreak(ctx, req.params.id, z.object({ axis: z.string(), answer: z.string() }).parse(req.body))));
  v1.post('/learners/:id/persona/feedback', learnerAuth, h(async (req) => {
    const { answer } = z.object({ answer: z.enum(['yes', 'partly', 'no']) }).parse(req.body);
    await ctx.db.query('update learner set persona_feedback = $2 where learner_id = $1', [req.params.id, answer]);
    return { saved: true };
  }));
  v1.post('/learners/:id/pathway', learnerAuth, h(async (req) => {
    const { length_months } = z.object({ length_months: z.union([z.literal(6), z.literal(12)]).optional() }).parse(req.body ?? {});
    const current = await currentPathway(ctx.db, req.params.id);
    const status = current && current.status !== 'proposed' && current.status !== 'completed' ? 'accepted' : 'proposed';
    await planPathway(ctx, req.params.id, { length: length_months ?? null, trigger: length_months ? 'length_changed' : 'assessment_complete', actor: 'learner', status });
    return learnerResults(ctx, req.params.id);
  }));
  v1.get('/learners/:id/results', learnerAuth, h(async (req) => learnerResults(ctx, req.params.id)));
  v1.get('/learners/:id/pathway', learnerAuth, h(async (req) => (await learnerResults(ctx, req.params.id)).pathway));
  v1.post('/learners/:id/pathway/banner/dismiss', learnerAuth, h(async (req) => {
    await ctx.db.query(`update pathway set banner = null where learner_id = $1`, [req.params.id]);
    return { ok: true };
  }));
  v1.post('/pathways/:pathwayId/accept', learnerAuth, h(async (req) => {
    await acceptPathway(ctx, res_locals(req).learnerId, req.params.pathwayId);
    return learnerResults(ctx, res_locals(req).learnerId);
  }));
  v1.delete('/learners/:id', learnerAuth, h(async (req) => deleteLearner(ctx, req.params.id)));

  // ----- course platform -----
  v1.post('/learners/:id/events', platformAuth, h(async (req) => handleEvent(ctx, req.params.id, eventSchema.parse(req.body))));

  // ----- staff -----
  v1.post('/staff/session', h(async (req) => {
    const { role, code } = z.object({ role: z.enum(['mentor', 'admin']), code: z.string().min(1) }).parse(req.body);
    const expected = role === 'admin' ? ctx.settings.adminCode : ctx.settings.mentorCode;
    if (!safeEqual(code, expected)) throw new HttpError(401, 'unauthorised', 'That access code is not right');
    return { token: ctx.staff.issue(role), role };
  }));
  v1.get('/mentor/learners', staffAuth('mentor'), h(async () => mentorList(ctx)));
  v1.get('/mentor/learners/:id', staffAuth('mentor'), h(async (req) => mentorDetail(ctx, req.params.id)));
  v1.post('/mentor/learners/:id/notes', staffAuth('mentor'), h(async (req) => {
    const { text } = z.object({ text: z.string().trim().min(1).max(2000) }).parse(req.body);
    await addMentorNote(ctx, req.params.id, text);
    return mentorDetail(ctx, req.params.id);
  }));
  v1.post('/runs/:runId/replay', staffAuth('mentor'), h(async (req) => replayRun(ctx, req.params.runId)));

  v1.get('/admin/courses', staffAuth('admin'), h(async () => listCourses(ctx)));
  v1.post('/admin/courses', staffAuth('admin'), h(async (req) => saveCourseDraft(ctx, req.body)));
  v1.post('/admin/courses/:courseId/validate', staffAuth('admin'), h(async (req) => validateDraft(ctx, req.params.courseId)));
  v1.post('/admin/courses/:courseId/simulate', staffAuth('admin'), h(async (req) => simulateDraft(ctx, req.params.courseId)));
  v1.post('/admin/courses/:courseId/activate', staffAuth('admin'), h(async (req) => activateDraft(ctx, req.params.courseId)));
  v1.get('/admin/versions', staffAuth('admin'), h(async () => listVersions(ctx)));
  v1.post('/admin/config/simulate', staffAuth('admin'), h(async (req) => simulateConfig(ctx, configChangeSchema.parse(req.body).config as unknown as EngineConfig)));
  v1.post('/admin/config', staffAuth('admin'), h(async (req) => createConfigVersion(ctx, configChangeSchema.parse(req.body))));
  v1.post('/admin/config/:version/activate', staffAuth('admin'), h(async (req) => activateVersion(ctx, 'engine_config', req.params.version)));
  v1.post('/admin/reference/:version/activate', staffAuth('admin'), h(async (req) => activateVersion(ctx, 'reference_version', req.params.version)));
  v1.get('/admin/reference', staffAuth('admin'), h(async () => referenceOverview(ctx)));

  app.use('/v1', v1);
  app.use('/v1', (_req, _res, next) => next(new HttpError(404, 'not_found', 'Not found')));

  // Production: serve the built screens from the same origin.
  const dist = join(process.cwd(), 'dist');
  if (ctx.settings.production && existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, message: err.message, details: err.details ?? null });
    if (err instanceof ZodError) return res.status(400).json({ error: 'bad_request', message: 'Some fields need attention', details: err.flatten() });
    if (err && typeof err === 'object' && 'type' in err && (err as { type: string }).type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_request', message: 'Invalid JSON', details: null });
    console.error(err);
    return res.status(500).json({ error: 'server_error', message: 'Something went wrong on our side. Your answers are saved. Please try again.', details: null });
  });

  return app;
}

function res_locals(req: Request): { learnerId: string } {
  return ((req as unknown as { _auth?: { learnerId: string } })._auth ??= { learnerId: '' });
}

export { getLearner };
