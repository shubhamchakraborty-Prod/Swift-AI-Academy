/**
 * L06 to L08: the skill check. Short tasks, scored on the server as you go; adaptive, so answers are final once sent.
 * Communication tasks are in English on purpose (they measure English); their instructions follow the app language.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headphones, Languages, MessagesSquare, Play, RotateCcw, Target } from 'lucide-react';
import { api, ApiError, screenTimer } from '../api';
import { ActionBar, AppBar, Choice, Loading, Stories } from '../components/ui';
import { useLearner, useToast } from '../state';
import { useI18n } from '../i18n';
import { playListening, speechSupported, stopAudio } from '../audio';

interface Item { item_id: string; text: string; strand: string | null; english_only: boolean; transcript: string | null; audio_url: string | null; options: { value: string; label: string }[] }
interface Next { done: boolean; answered: number; item?: Item }

function Listen({ text, audioUrl }: { text: string; audioUrl: string | null }) {
  const { t } = useI18n();
  const canPlay = Boolean(audioUrl) || speechSupported();
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(!canPlay);
  const [showText, setShowText] = useState(!canPlay);
  useEffect(() => () => stopAudio(), []);
  const play = async () => {
    setPlaying(true);
    setPlays((n) => n + 1);
    const ok = await playListening({ text, audioUrl, onEnd: () => setPlaying(false) });
    if (!ok) { setPlaying(false); setFailed(true); setShowText(true); }
  };
  return (
    <div className="card soft tight stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 10 }}>
        <span className="tile"><Headphones size={20} strokeWidth={1.75} /></span>
        <div className="grow"><strong>{t('s_listen')}</strong><p className="small muted">{t('s_listenHelp')}</p></div>
      </div>
      {canPlay && !failed ? (
        <button className="btn btn-secondary btn-block" onClick={play} disabled={playing} aria-live="polite">
          {playing ? t('s_playing') : plays === 0 ? <><Play size={18} /> {t('s_play')}</> : <><RotateCcw size={18} /> {t('s_playAgain')}</>}
        </button>
      ) : null}
      {failed ? <p className="small" role="status" style={{ color: 'var(--warning-700)' }}>{t('s_audioFail')}</p> : null}
      {showText ? <blockquote className="card tight" style={{ margin: 0 }} lang="en">{text}</blockquote> : (
        <button className="link-btn small" style={{ alignSelf: 'flex-start' }} onClick={() => setShowText(true)}>{t('s_read')}</button>
      )}
    </div>
  );
}

export default function SkillCheck({ series }: { series: 'ai' | 'comm' }) {
  const nav = useNavigate();
  const toast = useToast();
  const { t, lang } = useI18n();
  const { progress, refresh } = useLearner();
  const [next, setNext] = useState<Next | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [intro, setIntro] = useState(true);
  const first = useRef(true);
  const timer = useRef(screenTimer());
  const after = series === 'ai' ? '/journey/skills/communication' : '/journey/goals';

  const load = useCallback(async () => {
    const n = await api.get<Next>(`/learners/${progress!.learner_id}/skill-check/next?series=${series}`);
    if (n.done) { await refresh(); nav(after, { replace: true }); return; }
    setNext(n);
    if (first.current) { first.current = false; setIntro(n.answered === 0); }
  }, [series, progress, nav, refresh, after]);

  useEffect(() => { first.current = true; setNext(null); setChoice(null); load().catch((e) => toast(e.message, 'error')); }, [series]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (next) load().catch(() => undefined); }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { timer.current.reset(); setChoice(null); }, [next?.item?.item_id, intro]);

  const submit = async () => {
    if (!next?.item || !choice) return;
    setBusy(true);
    try {
      const n = await api.post<Next>(`/learners/${progress!.learner_id}/skill-check/answers`, { series, item_id: next.item.item_id, answer: choice, ms_taken: timer.current.elapsed() });
      if (n.done) { await refresh(); nav(after, { replace: true }); } else setNext(n);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('couldNotSave'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const title = series === 'ai' ? t('s_titleAi') : t('s_titleComm');
  const fraction = series === 'ai' ? Math.min(0.5, ((next?.answered ?? 0) / 8) * 0.5) : 0.5 + Math.min(0.48, ((next?.answered ?? 0) / 9) * 0.5);
  if (!next || !progress) return <><AppBar title={title} back="/" /><Loading /></>;

  if (intro) {
    return (
      <>
        <AppBar title={title} back="/" />
        <Stories part={2} fraction={fraction} />
        <main className="content center enter">
          <span className="tile lg">{series === 'ai' ? <Target size={26} strokeWidth={1.75} /> : <MessagesSquare size={26} strokeWidth={1.75} />}</span>
          <p className="eyebrow">{t('partOf', { n: 3 })}</p>
          <h1>{series === 'ai' ? t('s_aiTitle') : t('s_commTitle')}</h1>
          <p className="lede">{series === 'ai' ? t('s_aiBody') : t('s_commBody')}</p>
          {series === 'comm' && lang === 'hi' ? <p className="small"><Languages size={14} style={{ verticalAlign: '-2px' }} /> {t('s_englishOnly')}</p> : null}
          <p className="small muted">{t('s_noBack')}</p>
        </main>
        <ActionBar><button className="btn btn-primary btn-block" onClick={() => setIntro(false)}>{t('begin')}</button></ActionBar>
      </>
    );
  }

  const item = next.item!;
  const longOptions = item.options.some((o) => o.label.length > 70);
  return (
    <>
      <AppBar title={title} back="/" />
      <Stories part={2} fraction={fraction} saved={next.answered > 0} />
      <main className="content enter" key={item.item_id}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <p className="eyebrow muted">{t('taskN', { n: next.answered + 1 })}</p>
          {item.english_only && lang === 'hi' ? <span className="pill plain"><Languages size={13} /> English</span> : null}
        </div>
        {item.strand === 'listening' && item.transcript ? <Listen key={item.item_id} text={item.transcript} audioUrl={item.audio_url} /> : null}
        <h1 className="q-text" id="task" lang={item.english_only ? 'en' : undefined}>{item.text}</h1>
        <div className={`choices ${longOptions ? 'dense' : ''}`} role="radiogroup" aria-labelledby="task" lang={item.english_only ? 'en' : undefined}>
          {item.options.map((o) => <Choice key={o.value} label={o.label} selected={choice === o.value} onSelect={() => setChoice(o.value)} />)}
        </div>
      </main>
      <ActionBar hint={t('s_final')}>
        <button className="btn btn-primary btn-block" disabled={!choice || busy} onClick={submit}>{busy ? t('saving') : t('next')}</button>
      </ActionBar>
    </>
  );
}
