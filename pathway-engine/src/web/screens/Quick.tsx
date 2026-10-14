import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MessageCircleQuestion } from 'lucide-react';
import { api, ApiError } from '../api';
import { AppBar, Choice, Loading } from '../components/ui';
import { useLearner, useToast } from '../state';

interface TB { axis: string; question: string; item_text?: string; options: { value: string; label: string; help: string | null }[] }

/** L10: at most two tie-breaker questions, only when a persona axis is borderline. */
export default function Quick() {
  const nav = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const replan = params.get('replan') === '1';
  const { progress, refresh } = useLearner();
  const [queue, setQueue] = useState<TB[] | null>(null);
  const [asked, setAsked] = useState(0);
  const [busy, setBusy] = useState(false);

  const done = () => nav(replan ? '/journey/building?replan=1' : '/journey/building', { replace: true });
  useEffect(() => {
    api.post<{ tiebreak_needed: TB[] }>(`/learners/${progress!.learner_id}/persona`).then((r) => {
      if (!r.tiebreak_needed.length) done();
      else setQueue(r.tiebreak_needed);
    }).catch((e) => toast(e.message, 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!queue) return <><AppBar title="A quick question" back={false} /><Loading /></>;
  const q = queue[0];
  const answer = async (value: string) => {
    setBusy(true);
    try {
      const r = await api.post<{ tiebreak_needed: TB[] }>(`/learners/${progress!.learner_id}/persona/tiebreak`, { axis: q.axis, answer: value });
      setAsked((n) => n + 1);
      if (!r.tiebreak_needed.length) { await refresh(); done(); } else setQueue(r.tiebreak_needed);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not save. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AppBar title="A quick question" sub={`${asked + 1} of ${asked + queue.length}`} back={false} />
      <main className="content enter" key={q.axis}>
        <span className="tile lg"><MessageCircleQuestion size={26} strokeWidth={1.75} /></span>
        <p className="small muted">One more answer helps us choose the right plan for you.</p>
        <h1 className="q-text" id="tb">{q.question}</h1>
        {q.item_text ? <p className="statement" style={{ fontSize: 'var(--fs-lg)' }}>{q.item_text}</p> : null}
        <div className="choices" role="radiogroup" aria-labelledby="tb">
          {q.options.map((o) => <Choice key={o.value} label={o.label} help={o.help ?? undefined} selected={false} disabled={busy} onSelect={() => answer(o.value)} />)}
        </div>
      </main>
    </>
  );
}
