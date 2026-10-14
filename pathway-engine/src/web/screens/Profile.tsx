import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { api, ApiError, screenTimer } from '../api';
import { ActionBar, AppBar, Choice, Loading, Stories } from '../components/ui';
import { useLearner, useToast } from '../state';

interface BItem { item_id: string; text: string; stem: string | null; response_set: 'interest' | 'agreement' }
interface BData { items: BItem[]; response_sets: Record<string, { value: number; label_en: string }[]> }

/** L04 + L05 Learning profile: 40 statements, one per screen, five large answer buttons. */
export default function Profile() {
  const nav = useNavigate();
  const toast = useToast();
  const { progress, refresh } = useLearner();
  const [data, setData] = useState<BData | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [intro, setIntro] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const timer = useRef(screenTimer());

  useEffect(() => {
    api.get<BData>('/assessment/items?part=B').then((d) => {
      setData(d);
      const a = progress?.part_b.answers ?? {};
      setAnswers(a);
      const first = d.items.findIndex((i) => !(i.item_id in a));
      setIndex(first >= 0 ? first : d.items.length - 1);
      setIntro(Object.keys(a).length === 0);
    }).catch((e) => toast(e.message, 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { timer.current.reset(); }, [index, intro]);

  if (!data || !progress) return <><AppBar title="Learning profile" back="/" /><Loading /></>;
  const retake = progress.part_b.retake;

  if (intro) {
    return (
      <>
        <AppBar title="Learning profile" back={retake ? '/app/you' : '/'} />
        <Stories part={1} fraction={0} />
        <main className="content center enter">
          <span className="tile lg"><Sparkles size={26} strokeWidth={1.75} /></span>
          <p className="eyebrow">Part 2 of 4</p>
          <h1>There are no right or wrong answers</h1>
          <p className="lede">You will see {data.items.length} short statements, one at a time. Pick the answer that is most true for you. Go with your first thought.</p>
          <p className="small muted">About 8 to 10 minutes. Tap an answer to move on. You can go back to change it.</p>
        </main>
        <ActionBar><button className="btn btn-primary btn-block" onClick={() => setIntro(false)}>Begin</button></ActionBar>
      </>
    );
  }

  const item = data.items[index];
  const scale = data.response_sets[item.response_set];
  const answeredCount = Object.keys(answers).length;

  const choose = async (value: number) => {
    setAnswers((a) => ({ ...a, [item.item_id]: value }));
    setBusy(true);
    try {
      await api.post(`/learners/${progress.learner_id}/assessment/B/responses`, { item_id: item.item_id, value, ms_taken: timer.current.elapsed() });
      setSaved(true);
      const all = { ...answers, [item.item_id]: value };
      const nextOpen = data.items.findIndex((i, n) => n > index && !(i.item_id in all));
      const anyOpen = data.items.findIndex((i) => !(i.item_id in all));
      if (anyOpen === -1) {
        await api.post(`/learners/${progress.learner_id}/assessment/B`);
        await refresh();
        nav(retake ? '/journey/building?replan=1' : '/journey/skills', { replace: true });
        return;
      }
      setTimeout(() => setIndex(nextOpen >= 0 ? nextOpen : anyOpen), 160);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not save. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AppBar title="Learning profile" onBack={() => (index > 0 ? setIndex(index - 1) : setIntro(true))} />
      <Stories part={1} fraction={answeredCount / data.items.length} saved={saved} />
      <main className="content enter" key={item.item_id}>
        <p className="eyebrow muted">Statement {index + 1} of {data.items.length}</p>
        <div className="question">
          {item.stem ? <p className="q-stem">{item.stem}</p> : null}
          <p className="statement" id="statement">{item.text}</p>
        </div>
        <div className="scale choices" role="radiogroup" aria-labelledby="statement">
          {[...scale].reverse().map((o) => (
            <Choice key={o.value} label={o.label_en} selected={answers[item.item_id] === o.value} disabled={busy} onSelect={() => choose(o.value)} />
          ))}
        </div>
      </main>
    </>
  );
}
