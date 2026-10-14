/**
 * L11-L14 results, shown like stories: learner type, interests and directions, skills to build,
 * then the plan with the 6/12 month switch and "Start this plan". Sections are exported for reuse on the dashboard.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Compass, Info, Rocket, Sparkles } from 'lucide-react';
import { api, ApiError, session } from '../api';
import { ActionBar, AppBar, ErrorNote, LevelMeter, Loading, Segmented } from '../components/ui';
import { GoalIcon } from '../components/icons';
import { BuildElsewhere, ExploreOption, SkillsGained, Timeline } from '../components/plan';
import { fmtLevel } from '../journey';
import { useLearner, useToast } from '../state';
import type { Results as R } from '../types';

const STEPS = ['type', 'interests', 'skills', 'plan'] as const;
type S = (typeof STEPS)[number];
const REASON: Record<string, string> = { choice: 'Your choice', interests: 'Your interests', studies: 'Your studies', market: 'Many roles use these skills' };

export function useResults() {
  const [r, setR] = useState<R | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const load = () => api.get<R>(`/learners/${session.get()?.learnerId ?? ''}/results`).then(setR).catch(setError);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { r, setR, error, reload: load };
}

function StoryProgress({ step }: { step: S }) {
  const i = STEPS.indexOf(step);
  return (
    <div className="stories" aria-label={`Result ${i + 1} of 4`}>
      {STEPS.map((s, n) => <div className="seg" key={s}><i style={{ width: n <= i ? '100%' : '0%' }} /></div>)}
    </div>
  );
}

export function PersonaCard({ r, onFeedback }: { r: R; onFeedback?: (a: string) => void }) {
  return (
    <section className="stack-lg">
      <div className="card" style={{ background: 'var(--navy)', color: '#fff', borderColor: 'var(--navy)' }}>
        <p className="eyebrow" style={{ color: 'var(--gold)' }}>Your learner type</p>
        <h1 style={{ color: '#fff', fontSize: 'var(--fs-3xl)', marginTop: 6 }}>{r.persona.name}</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', marginTop: 8 }}>{r.persona.one_line}.</p>
      </div>
      <div className="card soft row" style={{ alignItems: 'flex-start' }}>
        <span className="tile"><Compass size={20} strokeWidth={1.75} /></span>
        <div><p className="label">What this means for your plan</p><p>{r.persona.meaning}</p></div>
      </div>
      <div className="row wrap">{r.persona.poles.map((p) => <span key={p.axis} className="pill plain">{p.axis}: <strong style={{ color: 'var(--navy)' }}>{p.pole}</strong></span>)}</div>
      {onFeedback ? (
        <div className="stack">
          <p className="label" id="fb">Does this sound like you?</p>
          <div className="segmented" role="radiogroup" aria-labelledby="fb">
            {[['yes', 'Yes'], ['partly', 'Partly'], ['no', 'Not really']].map(([v, l]) => (
              <button key={v} role="radio" aria-checked={r.persona.feedback === v} onClick={() => onFeedback(v)}>{l}</button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function InterestsAndGoals({ r }: { r: R }) {
  return (
    <section className="stack-lg">
      {r.interests ? (
        <div className="card stack">
          <h3>What you enjoy</h3>
          <p className="small muted">Your interests lean most towards <strong>{r.interests[0].name}</strong> work.</p>
          <ul className="list">
            {r.interests.map((i, n) => (
              <li key={i.orientation} className="stack" style={{ gap: 6 }}>
                <div className="row"><span className="spacer" style={{ fontWeight: n === 0 ? 800 : 600 }}>{i.name}</span></div>
                <div className={`bar ${n === 0 ? '' : 'navy'}`} role="img" aria-label={`${i.name}: ${i.score.toFixed(1)} out of 5`}><i style={{ width: `${((i.score - 1) / 4) * 100}%`, opacity: n === 0 ? 1 : 0.55 }} /></div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="banner warning"><Info size={20} /><span>We could not use your learning profile answers this time, so your plan is based on your other answers. {r.part_b_retake.available_at ? 'You can retake it from the You tab from tomorrow.' : ''}</span></div>
      )}
      <div className="stack">
        <h3>Where your skills could take you</h3>
        {r.goals.map((g, n) => (
          <article key={g.goal_id} className="card stack" style={{ gap: 10 }}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <span className="tile"><GoalIcon id={g.goal_id} /></span>
              <div className="spacer"><span className="eyebrow muted">Direction {n + 1}</span><h3>{g.name}</h3></div>
            </div>
            <p className="small muted">{g.definition}</p>
            <p className="small">Roles such as {g.example_roles.join(', ').toLowerCase()}.</p>
            <div className="row wrap"><span className="small muted">Why:</span>{g.reasons.map((x) => <span key={x} className="pill">{REASON[x] ?? x}</span>)}</div>
          </article>
        ))}
        {r.goal_note ? <div className="banner"><Info size={20} /><span>{r.goal_note}</span></div> : null}
      </div>
    </section>
  );
}

export function Gaps({ r }: { r: R }) {
  const desc = (lvl: number) => r.level_scale.find((l) => l.level === Math.floor(lvl))?.descriptor;
  return (
    <section className="stack">
      {r.top_gaps.length ? r.top_gaps.map((g) => (
        <article key={g.skill_id} className="card stack" style={{ gap: 8 }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="spacer"><strong>{g.name}</strong><p className="small muted">{g.definition}</p></div>
          </div>
          <LevelMeter have={g.current} need={g.needed} label={`You are at level ${fmtLevel(g.current)}. These kinds of work need level ${fmtLevel(g.needed)}.`} />
          <div className="row small"><span className="muted">Now: <strong style={{ color: 'var(--navy)' }}>Level {fmtLevel(g.current)}</strong></span><span className="spacer" /><span className="muted">Needed: <strong style={{ color: 'var(--gold-700)' }}>Level {fmtLevel(g.needed)}</strong></span></div>
          {desc(g.needed) ? <p className="small muted">Level {fmtLevel(Math.floor(g.needed))} means: {desc(g.needed)?.toLowerCase()}.</p> : null}
        </article>
      )) : <div className="banner success"><Sparkles size={20} /><span>You already hold the levels these kinds of work need.</span></div>}
    </section>
  );
}

export function PlanBody({ r, onLength, busyLength }: { r: R; onLength?: (m: 6 | 12) => void; busyLength?: boolean }) {
  return (
    <section className="stack-lg">
      {onLength && r.pathway.can_change_length ? (
        <div className="stack">
          <Segmented label="Plan length" value={r.pathway.length_months} onChange={(m) => !busyLength && onLength(m)} options={[{ value: 6, label: '6 months · 1 course' }, { value: 12, label: '12 months · 2 courses' }]} />
          {r.pathway.default_length === '6_then_extend' && r.pathway.length_months === 6 ? <p className="small muted">We suggest starting with 6 months. You can add a second course later.</p> : null}
        </div>
      ) : null}
      {r.pathway.summary ? <p className="lede" style={{ color: 'var(--navy)', fontWeight: 600 }}>{r.pathway.summary}</p> : null}
      {r.pathway.exploring_note ? <div className="banner"><Compass size={20} /><span>{r.pathway.exploring_note}</span></div> : null}
      {r.pathway.shortened && r.pathway.terms.length === 1 && r.pathway.length_months === 12 ? <div className="banner warning"><Info size={20} /><span>{r.templates.shorter_pathway}</span></div> : null}
      <Timeline r={r} />
      <SkillsGained skills={r.pathway.skills_gained} title={`What you will be able to do after ${r.pathway.length_months} months`} />
      <BuildElsewhere r={r} />
      <ExploreOption r={r} />
    </section>
  );
}

/** L11 to L14: four short result screens, then the plan to accept. */
export default function Results() {
  const { step = 'type' } = useParams<{ step: S }>();
  const nav = useNavigate();
  const toast = useToast();
  const { progress, refresh } = useLearner();
  const { r, setR, error } = useResults();
  const [busy, setBusy] = useState(false);
  const i = STEPS.indexOf(step as S);

  if (error) {
    if (error.status === 451) { nav('/guardian', { replace: true }); return null; }
    return <><AppBar title="Your plan" back="/" /><div className="content"><ErrorNote>{error.message}</ErrorNote></div></>;
  }
  if (!r || !progress) return <><AppBar title="Your results" back="/" /><Loading label="Loading your results" /></>;

  const go = (s: S) => nav(`/results/${s}`);
  const titles: Record<S, { eyebrow: string; title: string }> = {
    type: { eyebrow: 'Result 1 of 4', title: 'How you like to learn' },
    interests: { eyebrow: 'Result 2 of 4', title: 'Your interests and directions' },
    skills: { eyebrow: 'Result 3 of 4', title: 'Skills to build' },
    plan: { eyebrow: 'Result 4 of 4', title: 'Your course plan' },
  };

  const changeLength = async (m: 6 | 12) => {
    setBusy(true);
    try { setR(await api.post<R>(`/learners/${progress.learner_id}/pathway`, { length_months: m })); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Could not change the plan.', 'error'); }
    finally { setBusy(false); }
  };
  const accept = async () => {
    setBusy(true);
    try {
      await api.post(`/pathways/${r.pathway_id}/accept`);
      await refresh();
      toast('Plan started. You can find it here any time.');
      nav('/app', { replace: true });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not start the plan.', 'error');
      setBusy(false);
    }
  };
  const feedback = async (a: string) => {
    setR({ ...r, persona: { ...r.persona, feedback: a } });
    await api.post(`/learners/${progress.learner_id}/persona/feedback`, { answer: a }).catch(() => undefined);
  };

  return (
    <>
      <AppBar title={titles[step as S].title} onBack={() => (i > 0 ? go(STEPS[i - 1]) : nav('/'))} />
      <StoryProgress step={step as S} />
      <main className="content enter" key={step}>
        <p className="eyebrow">{titles[step as S].eyebrow}</p>
        {step === 'type' && <PersonaCard r={r} onFeedback={feedback} />}
        {step === 'interests' && <InterestsAndGoals r={r} />}
        {step === 'skills' && (<><p className="lede">These are the skills your chosen directions need most, and where you are today.</p><Gaps r={r} /></>)}
        {step === 'plan' && <PlanBody r={r} onLength={r.status === 'proposed' ? changeLength : undefined} busyLength={busy} />}
      </main>
      <ActionBar hint={step === 'plan' && r.status === 'proposed' ? 'You can change the plan length until your first course starts.' : undefined}>
        {step !== 'plan' ? (
          <button className="btn btn-primary btn-block" onClick={() => go(STEPS[i + 1])}>Next <ArrowRight size={18} /></button>
        ) : !r.pathway.terms.length ? (
          <button className="btn btn-secondary btn-block" onClick={() => nav('/journey/goals?edit=1')}>Change my goals</button>
        ) : r.status === 'proposed' ? (
          <button className="btn btn-primary btn-block" disabled={busy || !r.pathway.terms.length} onClick={accept}><Rocket size={18} /> Start this plan</button>
        ) : (
          <button className="btn btn-primary btn-block" onClick={() => nav('/app')}>Go to my plan</button>
        )}
      </ActionBar>
    </>
  );
}
