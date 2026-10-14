import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headphones, MessagesSquare, Play, RotateCcw, Target } from 'lucide-react';
import { api, ApiError, screenTimer } from '../api';
import { ActionBar, AppBar, Choice, Loading, Stories } from '../components/ui';
import { useLearner, useToast } from '../state';

interface Item { item_id: string; text: string; strand: string | null; transcript: string | null; options: { value: string; label: string }[] }
interface Next { done: boolean; answered: number; item?: Item }

/** Plays a listening item with the device's speech engine; falls back to the written message. */
function Listen({ text }: { text: string }) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [plays, setPlays] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [showText, setShowText] = useState(!supported);
  const play = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN';
    u.rate = 0.92;
    u.onend = () => setSpeaking(false);
    u.onerror = () => { setSpeaking(false); setShowText(true); };
    setSpeaking(true);
    setPlays((n) => n + 1);
    window.speechSynthesis.speak(u);
  };
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);
  return (
    <div className="card soft stack">
      <div className="row">
        <span className="tile"><Headphones size={20} strokeWidth={1.75} /></span>
        <div className="spacer"><strong>Listen to the message</strong><p className="small muted">Turn up your volume. You can play it again.</p></div>
      </div>
      {supported && (
        <button className="btn btn-secondary btn-block" onClick={play} aria-live="polite">
          {plays === 0 ? <><Play size={18} /> Play message</> : speaking ? 'Playing' : <><RotateCcw size={18} /> Play again</>}
        </button>
      )}
      {showText ? <blockquote className="card" style={{ margin: 0 }}>{text}</blockquote> : (
        <button className="link-btn small" style={{ alignSelf: 'flex-start' }} onClick={() => setShowText(true)}>Cannot listen right now? Read the message instead</button>
      )}
    </div>
  );
}

/** L06 to L08: short tasks scored as you go. Adaptive, so answers are final once sent. */
export default function SkillCheck({ series }: { series: 'ai' | 'comm' }) {
  const nav = useNavigate();
  const toast = useToast();
  const { progress, refresh } = useLearner();
  const [next, setNext] = useState<Next | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [intro, setIntro] = useState(true);
  const timer = useRef(screenTimer());

  const load = useCallback(async () => {
    const n = await api.get<Next>(`/learners/${progress!.learner_id}/skill-check/next?series=${series}`);
    if (n.done) {
      await refresh();
      nav(series === 'ai' ? '/journey/skills/communication' : '/journey/goals', { replace: true });
      return;
    }
    setNext(n);
    setIntro(n.answered === 0);
  }, [series, progress, nav, refresh]);

  useEffect(() => { setNext(null); setChoice(null); load().catch((e) => toast(e.message, 'error')); }, [series]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { timer.current.reset(); setChoice(null); }, [next?.item?.item_id, intro]);

  const submit = async () => {
    if (!next?.item || !choice) return;
    setBusy(true);
    try {
      const n = await api.post<Next>(`/learners/${progress!.learner_id}/skill-check/answers`, { series, item_id: next.item.item_id, answer: choice, ms_taken: timer.current.elapsed() });
      if (n.done) {
        await refresh();
        nav(series === 'ai' ? '/journey/skills/communication' : '/journey/goals', { replace: true });
      } else setNext(n);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not save. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const title = series === 'ai' ? 'Skill check: AI' : 'Skill check: Communication';
  const fraction = series === 'ai' ? Math.min(0.5, ((next?.answered ?? 0) / 8) * 0.5) : 0.5 + Math.min(0.48, ((next?.answered ?? 0) / 9) * 0.5);
  if (!next || !progress) return <><AppBar title={title} back="/" /><Loading /></>;

  if (intro) {
    return (
      <>
        <AppBar title={title} back="/" />
        <Stories part={2} fraction={fraction} />
        <main className="content center enter">
          <span className="tile lg">{series === 'ai' ? <Target size={26} strokeWidth={1.75} /> : <MessagesSquare size={26} strokeWidth={1.75} />}</span>
          <p className="eyebrow">Part 3 of 4</p>
          {series === 'ai' ? (
            <>
              <h1>Short tasks. Do your best.</h1>
              <p className="lede">Wrong answers do not count against you. This helps us start you at the right level, so the course is not too easy or too hard.</p>
            </>
          ) : (
            <>
              <h1>Now, a few communication tasks</h1>
              <p className="lede">Some tasks have a short audio message. Find a quiet place, or use earphones if you have them.</p>
            </>
          )}
          <p className="small muted">The questions change based on your answers, so you cannot go back in this part.</p>
        </main>
        <ActionBar><button className="btn btn-primary btn-block" onClick={() => setIntro(false)}>Begin</button></ActionBar>
      </>
    );
  }

  const item = next.item!;
  return (
    <>
      <AppBar title={title} back="/" />
      <Stories part={2} fraction={fraction} saved={next.answered > 0} />
      <main className="content enter" key={item.item_id}>
        <p className="eyebrow muted">Task {next.answered + 1}</p>
        {item.strand === 'listening' && item.transcript ? <Listen text={item.transcript} /> : null}
        <h1 className="q-text" id="task">{item.text}</h1>
        <div className="choices" role="radiogroup" aria-labelledby="task">
          {item.options.map((o) => <Choice key={o.value} label={o.label} selected={choice === o.value} onSelect={() => setChoice(o.value)} />)}
        </div>
      </main>
      <ActionBar hint="Your answer is final once you continue.">
        <button className="btn btn-primary btn-block" disabled={!choice || busy} onClick={submit}>{busy ? 'Saving' : 'Next'}</button>
      </ActionBar>
    </>
  );
}
