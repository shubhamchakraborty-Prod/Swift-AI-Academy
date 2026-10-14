/**
 * L11 to L14 results, shown like stories: learner type, interests and directions, skills to build, then the plan
 * with the 6/12 month switch and "Start this plan". Each screen fits one phone screen; details open in sheets.
 * Sections are exported for reuse on the home tabs.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ChevronRight, Compass, Info, Rocket, Sparkles } from 'lucide-react';
import { api, ApiError, session } from '../api';
import { ActionBar, AppBar, ErrorNote, LevelMeter, Loading, Sheet } from '../components/ui';
import { GoalIcon } from '../components/icons';
import { PlanOverview } from '../components/plan';
import { fmtLevel } from '../journey';
import { useLearner, useToast } from '../state';
import { useI18n } from '../i18n';
import type { StrKey } from '../strings';
import type { Results as R } from '../types';

const STEPS = ['type', 'interests', 'skills', 'plan'] as const;
type S = (typeof STEPS)[number];
const TITLES: Record<S, StrKey> = { type: 'r_type', interests: 'r_interests', skills: 'r_skills', plan: 'r_plan' };

/** Loads results in the current language and reloads when the language changes. */
export function useResults() {
  const { lang } = useI18n();
  const [r, setR] = useState<R | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const load = () => api.get<R>(`/learners/${session.get()?.learnerId ?? ''}/results`).then(setR).catch(setError);
  useEffect(() => { load(); }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  return { r, setR, error, reload: load };
}

function StoryProgress({ step }: { step: S }) {
  const { t } = useI18n();
  const i = STEPS.indexOf(step);
  return (
    <div className="stories" aria-label={t('r_of', { n: i + 1 })}>
      {STEPS.map((s, n) => <div className="seg" key={s}><i style={{ width: n <= i ? '100%' : '0%' }} /></div>)}
    </div>
  );
}

export function PersonaCard({ r, onFeedback, compact }: { r: R; onFeedback?: (a: string) => void; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <section className="stack" style={{ gap: 12 }}>
      <div className="card" style={{ background: 'var(--navy)', color: '#fff', borderColor: 'var(--navy)', padding: compact ? 16 : 20 }}>
        <p className="eyebrow" style={{ color: 'var(--gold)' }}>{t('r_yourType')}</p>
        <h1 style={{ color: '#fff', fontSize: compact ? 24 : 30, marginTop: 4 }}>{r.persona.name}</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', marginTop: 6, fontSize: 15 }}>{r.persona.one_line}.</p>
      </div>
      {!compact ? (
        <>
          <div className="card soft tight row" style={{ alignItems: 'flex-start' }}>
            <span className="tile"><Compass size={20} strokeWidth={1.75} /></span>
            <div><p className="label">{t('r_means')}</p><p className="small">{r.persona.meaning}</p></div>
          </div>
          <div className="chips">{r.persona.poles.map((p) => <span key={p.axis} className="chip"><span className="muted">{p.axis}:</span> {p.pole}</span>)}</div>
        </>
      ) : null}
      {onFeedback ? (
        <div className="stack" style={{ gap: 6 }}>
          <p className="label" id="fb">{t('r_sounds')}</p>
          <div className="segmented" role="radiogroup" aria-labelledby="fb">
            {([['yes', 'r_yes'], ['partly', 'r_partly'], ['no', 'r_no']] as const).map(([v, k]) => (
              <button key={v} role="radio" aria-checked={r.persona.feedback === v} onClick={() => onFeedback(v)}>{t(k)}</button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function InterestsAndGoals({ r }: { r: R }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const g = r.goals.find((x) => x.goal_id === open);
  return (
    <section className="stack" style={{ gap: 12 }}>
      {r.interests ? (
        <div className="card tight">
          <p className="label" style={{ marginBottom: 4 }}>{t('r_enjoy')}</p>
          <ul className="rows">
            {r.interests.map((i, n) => (
              <li key={i.orientation} style={{ padding: '5px 0' }}>
                <span className="grow" style={{ fontWeight: n === 0 ? 800 : 600, fontSize: 14 }}>{i.name}</span>
                <span className="mini-bar" role="img" aria-label={`${i.name}: ${i.score.toFixed(1)} / 5`}><i style={{ width: `${((i.score - 1) / 4) * 100}%`, opacity: n === 0 ? 1 : 0.5 }} /></span>
              </li>
            ))}
          </ul>
        </div>
      ) : <div className="banner warning small"><Info size={18} /><span>{t('r_noProfile')}</span></div>}
      <div className="stack" style={{ gap: 8 }}>
        <p className="label">{t('r_directions')}</p>
        {r.goals.map((goal) => (
          <button key={goal.goal_id} type="button" className="row-btn card tight" onClick={() => setOpen(goal.goal_id)}>
            <span className="tile"><GoalIcon id={goal.goal_id} /></span>
            <span className="grow stack" style={{ gap: 4 }}>
              <span className="title">{goal.name}</span>
              <span className="chips">{goal.reasons.map((x) => <span key={x} className="chip">{t(`reason_${x}` as StrKey)}</span>)}</span>
            </span>
            <ChevronRight size={20} style={{ color: 'var(--muted)' }} />
          </button>
        ))}
        {r.goal_note ? <p className="sub"><Info size={14} style={{ verticalAlign: '-2px' }} /> {r.goal_note}</p> : null}
      </div>
      {g ? (
        <Sheet title={g.name} onClose={() => setOpen(null)}>
          <div className="stack">
            <p>{g.definition}</p>
            <ul className="rows">{g.example_roles.map((x) => <li key={x}><span className="grow">{x}</span></li>)}</ul>
            <div className="chips"><span className="small muted">{t('r_why')}:</span>{g.reasons.map((x) => <span key={x} className="chip">{t(`reason_${x}` as StrKey)}</span>)}</div>
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}

export function Gaps({ r, limit }: { r: R; limit?: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const desc = (lvl: number) => r.level_scale.find((l) => l.level === Math.floor(lvl))?.descriptor;
  const gaps = limit ? r.top_gaps.slice(0, limit) : r.top_gaps;
  const g = r.top_gaps.find((x) => x.skill_id === open);
  if (!gaps.length) return <div className="banner success"><Sparkles size={20} /><span>{t('r_allHeld')}</span></div>;
  return (
    <>
      <ul className="rows card tight">
        {gaps.map((x) => (
          <li key={x.skill_id}>
            <button type="button" className="row-btn" onClick={() => setOpen(x.skill_id)} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              <span className="row" style={{ gap: 8 }}>
                <span className="grow title clamp2">{x.name}</span>
                <span className="pill navy mono" style={{ fontSize: 11.5 }}>{fmtLevel(x.current)} → {fmtLevel(x.needed)}</span>
              </span>
              <LevelMeter have={x.current} need={x.needed} label={`${t('r_now')} ${fmtLevel(x.current)}, ${t('r_needed')} ${fmtLevel(x.needed)}`} />
            </button>
          </li>
        ))}
      </ul>
      {g ? (
        <Sheet title={g.name} onClose={() => setOpen(null)}>
          <div className="stack">
            <p>{g.definition}</p>
            <LevelMeter have={g.current} need={g.needed} label={`${t('r_now')} ${fmtLevel(g.current)}, ${t('r_needed')} ${fmtLevel(g.needed)}`} />
            <p className="small"><strong>{t('r_now')}:</strong> {t('r_levelMeans', { n: fmtLevel(Math.floor(g.current)), d: desc(g.current) ?? '' })}</p>
            <p className="small"><strong>{t('r_needed')}:</strong> {t('r_levelMeans', { n: fmtLevel(Math.floor(g.needed)), d: desc(g.needed) ?? '' })}</p>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

export default function Results() {
  const { step = 'type' } = useParams<{ step: S }>();
  const nav = useNavigate();
  const toast = useToast();
  const { t } = useI18n();
  const { progress, refresh } = useLearner();
  const { r, setR, error } = useResults();
  const [busy, setBusy] = useState(false);
  const i = STEPS.indexOf(step as S);

  if (error) {
    if (error.status === 451) { nav('/guardian', { replace: true }); return null; }
    return <><AppBar title={t('r_plan')} back="/" /><div className="content"><ErrorNote>{error.message}</ErrorNote></div></>;
  }
  if (!r || !progress) return <><AppBar title={t('r_plan')} back="/" /><Loading /></>;

  const go = (s: S) => nav(`/results/${s}`);
  const changeLength = async (m: 6 | 12) => {
    setBusy(true);
    try { setR(await api.post<R>(`/learners/${progress.learner_id}/pathway`, { length_months: m })); }
    catch (e) { toast(e instanceof ApiError ? e.message : t('errorGeneric'), 'error'); }
    finally { setBusy(false); }
  };
  const accept = async () => {
    setBusy(true);
    try {
      await api.post(`/pathways/${r.pathway_id}/accept`);
      await refresh();
      toast(t('r_started'));
      nav('/app', { replace: true });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('errorGeneric'), 'error');
      setBusy(false);
    }
  };
  const feedback = async (a: string) => {
    setR({ ...r, persona: { ...r.persona, feedback: a } });
    await api.post(`/learners/${progress.learner_id}/persona/feedback`, { answer: a }).catch(() => undefined);
  };

  return (
    <>
      <AppBar title={t(TITLES[step as S])} onBack={() => (i > 0 ? go(STEPS[i - 1]) : nav('/'))} />
      <StoryProgress step={step as S} />
      <main className="content enter" key={step} style={{ gap: 12 }}>
        {step !== 'plan' ? <p className="eyebrow">{t('r_of', { n: i + 1 })}</p> : null}
        {step === 'type' && <PersonaCard r={r} onFeedback={feedback} />}
        {step === 'interests' && <InterestsAndGoals r={r} />}
        {step === 'skills' && (<><p className="small muted">{t('r_gapsIntro')}</p><Gaps r={r} /></>)}
        {step === 'plan' && <PlanOverview r={r} onLength={r.status === 'proposed' ? changeLength : undefined} busyLength={busy} />}
      </main>
      <ActionBar hint={step === 'plan' && r.status === 'proposed' && r.pathway.terms.length ? t('r_changeHint') : undefined}>
        {step !== 'plan' ? (
          <button className="btn btn-primary btn-block" onClick={() => go(STEPS[i + 1])}>{t('next')} <ArrowRight size={18} /></button>
        ) : !r.pathway.terms.length ? (
          <button className="btn btn-secondary btn-block" onClick={() => nav('/journey/goals?edit=1')}>{t('r_changeGoals')}</button>
        ) : r.status === 'proposed' ? (
          <button className="btn btn-primary btn-block" disabled={busy} onClick={accept}><Rocket size={18} /> {t('r_start')}</button>
        ) : (
          <button className="btn btn-primary btn-block" onClick={() => nav('/app')}>{t('r_goPlan')}</button>
        )}
      </ActionBar>
    </>
  );
}
