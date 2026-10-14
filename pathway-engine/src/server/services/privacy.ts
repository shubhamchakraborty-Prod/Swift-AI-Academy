import { createHash } from 'node:crypto';
import type { Ctx } from '../context';
import { logEvent } from '../context';
import { newId } from '../crypto';

/** Deletion on request: personal records go; runs are kept only in anonymised form (NFR Privacy). */
export async function deleteLearner(ctx: Ctx, learnerId: string) {
  const anon = 'ANON-' + createHash('sha256').update(learnerId + ctx.settings.sessionSecret).digest('hex').slice(0, 12).toUpperCase();
  await ctx.db.tx(async (q) => {
    await q.query(`update recommendation_run set learner_id = $2, inputs = inputs - 'profile' || jsonb_build_object('profile', jsonb_build_object('age', inputs->'profile'->'age')) where learner_id = $1`, [learnerId, anon]);
    await q.query('update event_log set learner_id = $2 where learner_id = $1', [learnerId, anon]);
    await q.query('delete from learner where learner_id = $1', [learnerId]);
    await logEvent(q, { id: newId('E'), learner_id: anon, type: 'learner_deleted', actor: 'learner' });
  });
  return { deleted: true };
}
