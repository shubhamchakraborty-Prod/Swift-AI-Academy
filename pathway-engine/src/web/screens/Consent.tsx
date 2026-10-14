import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, UserRound, Users } from 'lucide-react';
import { api, ApiError, session } from '../api';
import { ActionBar, AppBar, Choice, ErrorNote, Loading } from '../components/ui';
import { useLearner } from '../state';

interface Meta {
  consent: { min_age: number; guardian_required_below_age: number; purposes: { id: string; required: boolean; label_en: string }[] };
  guardian_relations: { value: string; label: string }[];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function ageFrom(y: number, m: number, d: number) {
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age;
}

type Stage = 'name' | 'dob' | 'too_young' | 'guardian' | 'consent';

/** L02: one question per screen. Name, date of birth, guardian check for under-17s, consent per purpose. */
export default function Consent() {
  const nav = useNavigate();
  const { refresh } = useLearner();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [stage, setStage] = useState<Stage>('name');
  const [name, setName] = useState('');
  const [dob, setDob] = useState({ d: '', m: '', y: '' });
  const [guardian, setGuardian] = useState<{ present: boolean | null; name: string; relation: string; consent: boolean }>({ present: null, name: '', relation: '', consent: false });
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get<Meta>('/meta').then(setMeta).catch((e) => setError(e.message)); }, []);
  const years = useMemo(() => { const y = new Date().getFullYear(); return Array.from({ length: 70 }, (_, i) => y - 10 - i); }, []);

  if (!meta) return error ? <div className="content"><ErrorNote>{error}</ErrorNote></div> : <Loading />;
  const age = dob.d && dob.m && dob.y ? ageFrom(+dob.y, +dob.m, +dob.d) : null;
  const needsGuardian = age !== null && age < meta.consent.guardian_required_below_age;
  const dobValid = age !== null && new Date(+dob.y, +dob.m - 1, +dob.d).getDate() === +dob.d;

  const back = () => {
    setError(null);
    if (stage === 'name') nav('/');
    else if (stage === 'dob') setStage('name');
    else if (stage === 'too_young' || stage === 'guardian') setStage('dob');
    else setStage(needsGuardian ? 'guardian' : 'dob');
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        dob: `${dob.y}-${dob.m.padStart(2, '0')}-${dob.d.padStart(2, '0')}`,
        consents,
        guardian: needsGuardian ? { present: Boolean(guardian.present), ...(guardian.present ? { name: guardian.name.trim(), relation: guardian.relation, consent: guardian.consent } : {}) } : undefined,
      };
      const out = await api.post<{ learner_id: string; token: string }>('/learners', body);
      session.set({ learnerId: out.learner_id, token: out.token });
      await refresh();
      nav('/journey/about', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const requiredMissing = meta.consent.purposes.some((p) => p.required && !consents[p.id]);
  const guardianReady = guardian.present === false || (guardian.present === true && guardian.name.trim().length >= 2 && guardian.relation && guardian.consent);
  const stepNo = { name: 1, dob: 2, too_young: 2, guardian: 3, consent: needsGuardian ? 4 : 3 }[stage];
  const total = needsGuardian ? 4 : 3;

  return (
    <>
      <AppBar title="Before we start" sub={`Step ${stepNo} of ${total}`} onBack={back} />
      {stage === 'name' && (
        <form className="content enter" onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) setStage('dob'); }} id="f-name">
          <span className="tile lg"><UserRound size={26} strokeWidth={1.75} /></span>
          <div className="question">
            <label className="q-text" htmlFor="name">What is your full name?</label>
            <p className="q-help">As it should appear on your records.</p>
          </div>
          <input id="name" className="input" autoFocus autoComplete="name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </form>
      )}
      {stage === 'dob' && (
        <form className="content enter" id="f-dob" onSubmit={(e) => { e.preventDefault(); if (!dobValid) return; setStage(age! < meta.consent.min_age ? 'too_young' : needsGuardian ? 'guardian' : 'consent'); }}>
          <div className="question">
            <h1 className="q-text">When were you born?</h1>
            <p className="q-help">We use this only to check your age.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1.3fr', gap: 8 }}>
            <div className="field"><label htmlFor="dob-d">Day</label>
              <select id="dob-d" className="select" value={dob.d} onChange={(e) => setDob({ ...dob, d: e.target.value })}><option value="">Day</option>{Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></div>
            <div className="field"><label htmlFor="dob-m">Month</label>
              <select id="dob-m" className="select" value={dob.m} onChange={(e) => setDob({ ...dob, m: e.target.value })}><option value="">Month</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
            <div className="field"><label htmlFor="dob-y">Year</label>
              <select id="dob-y" className="select" value={dob.y} onChange={(e) => setDob({ ...dob, y: e.target.value })}><option value="">Year</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
          </div>
          {dob.d && dob.m && dob.y && !dobValid ? <ErrorNote>That date does not exist. Check the day and month.</ErrorNote> : null}
        </form>
      )}
      {stage === 'too_young' && (
        <main className="content enter">
          <span className="tile lg gold"><ShieldCheck size={26} strokeWidth={1.75} /></span>
          <h1>This assessment is for learners aged {meta.consent.min_age} and above</h1>
          <p className="lede">Thank you for your interest. Please come back when you turn {meta.consent.min_age}. Your teacher can tell you about other Swift AI Academy activities for your age.</p>
        </main>
      )}
      {stage === 'guardian' && (
        <main className="content enter">
          <span className="tile lg"><Users size={26} strokeWidth={1.75} /></span>
          <div className="question">
            <h1 className="q-text">Is your parent or guardian with you right now?</h1>
            <p className="q-help">Learners under {meta.consent.guardian_required_below_age} need a parent or guardian to agree before we show the plan.</p>
          </div>
          <div className="choices" role="radiogroup" aria-label="Is your parent or guardian with you?">
            <Choice label="Yes, they are with me" selected={guardian.present === true} onSelect={() => setGuardian({ ...guardian, present: true })} />
            <Choice label="Not right now" help="You can still start. We will show your plan after they agree." selected={guardian.present === false} onSelect={() => setGuardian({ ...guardian, present: false })} />
          </div>
          {guardian.present && (
            <div className="card soft stack enter">
              <p className="eyebrow muted">For the parent or guardian</p>
              <div className="field"><label htmlFor="g-name">Your full name</label><input id="g-name" className="input" value={guardian.name} maxLength={100} onChange={(e) => setGuardian({ ...guardian, name: e.target.value })} /></div>
              <div className="field"><label htmlFor="g-rel">Your relationship to the learner</label>
                <select id="g-rel" className="select" value={guardian.relation} onChange={(e) => setGuardian({ ...guardian, relation: e.target.value })}>
                  <option value="">Choose</option>{meta.guardian_relations.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select></div>
              <label className="check"><input type="checkbox" checked={guardian.consent} onChange={(e) => setGuardian({ ...guardian, consent: e.target.checked })} />
                <span>I am the parent or guardian. I agree to {name.split(' ')[0] || 'the learner'} taking this assessment and to the uses listed on the next screen.</span></label>
            </div>
          )}
        </main>
      )}
      {stage === 'consent' && (
        <main className="content enter">
          <span className="tile lg"><ShieldCheck size={26} strokeWidth={1.75} /></span>
          <div className="question">
            <h1 className="q-text">How we use your answers</h1>
            <p className="q-help">Tick each one you agree to. You can ask us to delete your data at any time.</p>
          </div>
          <div className="stack">
            {meta.consent.purposes.map((p) => (
              <label key={p.id} className="check">
                <input type="checkbox" checked={Boolean(consents[p.id])} onChange={(e) => setConsents({ ...consents, [p.id]: e.target.checked })} />
                <span className="stack" style={{ gap: 4 }}>
                  <span style={{ fontWeight: 700 }}>{p.label_en}</span>
                  <span className={`pill ${p.required ? '' : 'plain'}`} style={{ alignSelf: 'flex-start' }}>{p.required ? 'Needed' : 'Optional'}</span>
                </span>
              </label>
            ))}
          </div>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
        </main>
      )}
      {stage !== 'too_young' && (
        <ActionBar hint={stage === 'consent' && requiredMissing ? 'The two needed items are required to build your plan.' : undefined}>
          {stage === 'name' && <button className="btn btn-primary btn-block" type="submit" form="f-name" disabled={name.trim().length < 2}>Next</button>}
          {stage === 'dob' && <button className="btn btn-primary btn-block" type="submit" form="f-dob" disabled={!dobValid}>Next</button>}
          {stage === 'guardian' && <button className="btn btn-primary btn-block" disabled={!guardianReady} onClick={() => setStage('consent')}>Next</button>}
          {stage === 'consent' && <button className="btn btn-primary btn-block" disabled={requiredMissing || busy} onClick={submit}>{busy ? 'Saving' : 'Agree and continue'}</button>}
        </ActionBar>
      )}
      {stage === 'too_young' && <ActionBar><button className="btn btn-secondary btn-block" onClick={() => nav('/')}>Back to start</button></ActionBar>}
    </>
  );
}
