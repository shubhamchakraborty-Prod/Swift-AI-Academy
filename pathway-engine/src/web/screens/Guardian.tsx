import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { api, ApiError } from '../api';
import { ActionBar, AppBar, ErrorNote } from '../components/ui';
import { useLearner } from '../state';

/** Guardian consent later, on the learner's device. Results stay hidden until it is given. */
export default function Guardian() {
  const nav = useNavigate();
  const { progress, refresh } = useLearner();
  const [relations, setRelations] = useState<{ value: string; label: string }[]>([]);
  const [age, setAge] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', relation: '', consent: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/meta').then((m) => { setRelations(m.guardian_relations); setAge(m.consent.guardian_required_below_age); }).catch(() => undefined); }, []);
  const ready = form.name.trim().length >= 2 && form.relation && form.consent;
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/learners/${progress!.learner_id}/guardian-consent`, { name: form.name.trim(), relation: form.relation, consent: true });
      await refresh();
      nav('/journey/building', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AppBar title="Parent or guardian" back="/" />
      <main className="content enter">
        <span className="tile lg gold"><Users size={26} strokeWidth={1.75} /></span>
        <h1>Your answers are saved</h1>
        <p className="lede">Your plan is ready to build. Because you are under {age ?? 'the required age'}, a parent or guardian needs to agree first. Hand your phone to them for this step.</p>
        <div className="card soft stack">
          <p className="eyebrow muted">For the parent or guardian</p>
          <div className="field"><label htmlFor="gn">Your full name</label><input id="gn" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="gr">Your relationship to the learner</label>
            <select id="gr" className="select" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })}>
              <option value="">Choose</option>{relations.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select></div>
          <label className="check"><input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
            <span>I am the parent or guardian. I agree to this learner's answers being stored and scored to build a course plan.</span></label>
        </div>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </main>
      <ActionBar hint="Not with them now? Close the app. Everything is saved for later.">
        <button className="btn btn-primary btn-block" disabled={!ready || busy} onClick={submit}>{busy ? 'Saving' : 'Agree and show the plan'}</button>
      </ActionBar>
    </>
  );
}
