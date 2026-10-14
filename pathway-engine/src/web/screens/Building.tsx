import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { ActionBar, AppBar, ErrorNote } from '../components/ui';
import { useLearner, useToast } from '../state';

/** Runs the engine. No artificial delay: the screen shows only while the request is in flight. */
export default function Building() {
  const nav = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const replan = params.get('replan') === '1';
  const { progress, refresh } = useLearner();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const p = await api.post<{ tiebreak_needed: unknown[] }>(`/learners/${progress!.learner_id}/persona`);
        if (p.tiebreak_needed.length) return nav(replan ? '/journey/quick?replan=1' : '/journey/quick', { replace: true });
        await api.post(`/learners/${progress!.learner_id}/pathway`);
        await refresh();
        if (!live) return;
        if (replan) { toast('Your plan has been updated'); nav('/app', { replace: true }); }
        else nav('/results', { replace: true });
      } catch (e) {
        if (e instanceof ApiError && e.status === 451) return nav('/guardian', { replace: true });
        if (e instanceof ApiError && e.status === 422 && e.details?.missing_part) { await refresh(); return nav('/', { replace: true }); }
        if (live) setError(e instanceof ApiError ? e.message : 'Something went wrong.');
      }
    })();
    return () => { live = false; };
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <AppBar title="Your plan" back={false} />
      <main className="content center enter" style={{ alignItems: 'center', textAlign: 'center' }} aria-busy={!error}>
        {error ? <ErrorNote>{error}</ErrorNote> : (
          <>
            <div className="spinner" />
            <h1>Building your plan</h1>
            <p className="lede">Matching your answers with our courses.</p>
          </>
        )}
      </main>
      {error ? <ActionBar><button className="btn btn-primary btn-block" onClick={() => { setError(null); setAttempt((n) => n + 1); }}>Try again</button></ActionBar> : null}
    </>
  );
}
