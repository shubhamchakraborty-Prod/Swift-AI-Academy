import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { ActionBar, AppBar, ErrorNote } from '../components/ui';
import { useLearner } from '../state';
import { useI18n } from '../i18n';

/** Guardian consent later, on the learner's device. Results stay hidden until it is given. */
export default function Guardian() {
  const nav = useNavigate();
  const { progress, refresh } = useLearner();
  const { t, lang } = useI18n();
  const [relations, setRelations] = useState<{ value: string; label: string }[]>([]);
  const [age, setAge] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', relation: '', consent: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/meta').then((m) => { setRelations(m.guardian_relations); setAge(m.consent.guardian_required_below_age); }).catch(() => undefined); }, [lang]);
  const ready = form.name.trim().length >= 2 && form.relation && form.consent;
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/learners/${progress!.learner_id}/guardian-consent`, { name: form.name.trim(), relation: form.relation, consent: true });
      await refresh();
      nav('/journey/building', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AppBar title={t('gd_title')} back="/" />
      <main className="content enter">
                <h1>{t('gd_saved')}</h1>
        <p className="lede">{t('gd_body', { age: age ?? '' })}</p>
        <div className="card soft stack">
          <p className="eyebrow muted">{t('c_forG')}</p>
          <div className="field"><label htmlFor="gn">{t('c_gName')}</label><input id="gn" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="gr">{t('c_gRel')}</label>
            <select id="gr" className="select" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })}>
              <option value="">{t('choose')}</option>{relations.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select></div>
          <label className="check"><input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
            <span>{t('gd_agree')}</span></label>
        </div>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </main>
      <ActionBar hint={t('gd_hint')}>
        <button className="btn btn-primary btn-block" disabled={!ready || busy} onClick={submit}>{busy ? t('saving') : t('gd_submit')}</button>
      </ActionBar>
    </>
  );
}
