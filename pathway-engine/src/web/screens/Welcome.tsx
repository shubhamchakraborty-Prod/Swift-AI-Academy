/**
 * L01 Welcome: what the assessment is, how long it takes, privacy. Offers Continue for returning learners.
 */
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, Lock, Route, Save } from 'lucide-react';
import { ActionBar, Brand } from '../components/ui';
import { useLearner } from '../state';
import { pathForStep, STEP_LABEL } from '../journey';

/** The journey at a glance: four parts, then a plan. Explains the flow instead of decorating it. */
function JourneyMap() {
  const steps = ['About you', 'Learning profile', 'Skill check', 'Goals'];
  return (
    <ol className="card soft" style={{ listStyle: 'none', margin: 0, padding: 'var(--s5)', display: 'flex', flexDirection: 'column', gap: 12 }} aria-label="What you will do">
      {steps.map((s, i) => (
        <li key={s} className="row" style={{ gap: 12 }}>
          <span className="term-dot planned" style={{ position: 'static' }} aria-hidden="true">{i + 1}</span>
          <span style={{ fontWeight: 700 }}>{s}</span>
        </li>
      ))}
      <li className="row" style={{ gap: 12 }}>
        <span className="term-dot" style={{ position: 'static' }} aria-hidden="true"><Route size={13} strokeWidth={2.5} /></span>
        <span style={{ fontWeight: 800 }}>Your course plan, with reasons</span>
      </li>
    </ol>
  );
}

export default function Welcome() {
  const { progress, hasSession, loading, signOut } = useLearner();
  const nav = useNavigate();
  const resume = hasSession && progress;
  return (
    <>
      <header className="appbar" style={{ gridTemplateColumns: '1fr auto' }}>
        <div style={{ paddingLeft: 8 }}><Brand /></div>
        <span />
      </header>
      <main className="content enter">
        <div className="stack">
          <p className="eyebrow">Swift Pathway Assessment</p>
          <h1>Find the right course for you</h1>
          <p className="lede">Answer a few short questions about yourself. We will suggest 1 or 2 Swift AI Academy courses for the next 6 or 12 months, and tell you why.</p>
        </div>
        <JourneyMap />
        <ul className="list" aria-label="Good to know">
          <li className="row"><span className="tile"><Clock size={20} strokeWidth={1.75} /></span><span><strong>About 30 minutes.</strong> <span className="muted">Take a break any time.</span></span></li>
          <li className="row"><span className="tile"><Save size={20} strokeWidth={1.75} /></span><span><strong>Saved after every answer.</strong> <span className="muted">Come back and continue where you stopped.</span></span></li>
          <li className="row"><span className="tile"><Lock size={20} strokeWidth={1.75} /></span><span><strong>Your answers stay private.</strong> <span className="muted">We never ask about caste, religion, income or health.</span></span></li>
        </ul>
      </main>
      <ActionBar
        hint={resume ? <>Not you? <button className="link-btn" onClick={() => { signOut(); nav('/start'); }}>Start as someone else</button></> : <>Mentors and admins: <Link to="/staff">sign in here</Link></>}
      >
        {resume ? (
          <button className="btn btn-primary btn-block" onClick={() => nav(pathForStep(progress.step))}>
            {progress.step === 'dashboard' ? 'Open my plan' : `Continue: ${STEP_LABEL[progress.step]}`} <ArrowRight size={18} />
          </button>
        ) : (
          <button className="btn btn-primary btn-block" disabled={loading} onClick={() => nav('/start')}>Start <ArrowRight size={18} /></button>
        )}
      </ActionBar>
    </>
  );
}
