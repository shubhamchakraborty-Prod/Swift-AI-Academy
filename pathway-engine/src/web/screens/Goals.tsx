/**
 * L09 Goals: pick up to 2 kinds of work (in order), then 3 quick choices and an optional note.
 * The 12 cards are compact tiles so all of them fit one screen; example roles show for the picked ones.
 * With ?edit=1 (from the You tab) it updates goals and re-plans future terms.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { api, ApiError, screenTimer } from '../api';
import { ActionBar, AppBar, Choice, Loading, Stories } from '../components/ui';
import { GoalIcon } from '../components/icons';
import { useLearner, useToast } from '../state';
import { useI18n } from '../i18n';
import type { ProfileItem } from '../types';

interface DData { items: ProfileItem[]; goal_areas: { goal_id: string; name: string; definition: string; example_roles: string[] }[] }

export default function Goals() {
  const nav = useNavigate();
  const toast = useToast();
  const { t, lang } = useI18n();
  const [params] = useSearchParams();
  const editing = params.get('edit') === '1';
  const { progress, refresh } = useLearner();
  const [data, setData] = useState<DData | null>(null);
  const [stage, setStage] = useState(0); // 0 cards, 1..3 single choices, 4 note
  const [picked, setPicked] = useState<string[]>([]);
  const [notSure, setNotSure] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useRef(screenTimer());

  useEffect(() => { api.get<DData>('/assessment/items?part=D').then(setData).catch((e) => toast(e.message, 'error')); }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (progress?.goals) {
      setPicked(progress.goals.goal_areas);
      setNotSure(progress.goals.goal_areas.length === 0);
      setAnswers({ main_goal: progress.goals.main_goal, earning_need: progress.goals.earning_need, mobility: progress.goals.mobility });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !progress) return <><AppBar title={t('g_title')} back="/" /><Loading /></>;
  const singles = data.items.filter((i) => i.type === 'single');
  const noteItem = data.items.find((i) => i.type === 'text');
  const cardsItem = data.items.find((i) => i.type === 'goal_cards');
  const total = 2 + singles.length;
  const back = () => (stage > 0 ? setStage(stage - 1) : nav(editing ? '/app/you' : '/'));

  const toggle = (id: string) => {
    setNotSure(false);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 2 ? [p[0], id] : [...p, id]));
  };

  const submit = async () => {
    setBusy(true);
    try {
      const out = await api.post<{ replanned: boolean; tiebreak_needed: unknown[] }>(`/learners/${progress.learner_id}/assessment/D`, {
        goal_areas: notSure ? [] : picked, main_goal: answers.main_goal, earning_need: answers.earning_need, mobility: answers.mobility, note, ms_taken: timer.current.elapsed(),
      });
      await refresh();
      if (editing) {
        if (out.tiebreak_needed.length) nav('/journey/quick?replan=1', { replace: true });
        else { toast(t('d_goalsSaved')); nav('/app', { replace: true }); }
      } else nav('/journey/building', { replace: true });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('couldNotSave'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <>
      <AppBar title={editing ? t('g_update') : t('g_title')} onBack={back} />
      {!editing ? <Stories part={3} fraction={stage / total} /> : null}
    </>
  );

  if (stage === 0) {
    const pickedRoles = picked.map((id) => data.goal_areas.find((g) => g.goal_id === id)!).map((g) => g.example_roles.join(', ')).join('; ');
    return (
      <>
        {header}
        <main className="content enter" style={{ gap: 12 }}>
          <p className="eyebrow muted">{t('questionOf', { n: 1, total })}</p>
          <div className="question">
            <h1 className="q-text" id="q-d1">{cardsItem?.text_en}</h1>
            <p className="q-help">{cardsItem?.help_en}</p>
          </div>
          <div className="goal-grid compact" role="group" aria-labelledby="q-d1">
            {data.goal_areas.map((g) => {
              const pos = picked.indexOf(g.goal_id);
              return (
                <button key={g.goal_id} type="button" className="goal-card" aria-pressed={pos >= 0} onClick={() => toggle(g.goal_id)} title={g.definition}>
                  <span className="tile"><GoalIcon id={g.goal_id} size={18} /></span>
                  <span className="gc-name">{g.name}</span>
                  {pos >= 0 ? <span className="badge-order">{pos === 0 ? t('g_first') : t('g_second')}</span> : null}
                </button>
              );
            })}
            <button type="button" className="goal-card" aria-pressed={notSure} onClick={() => { setNotSure(!notSure); setPicked([]); }} style={{ gridColumn: '1 / -1', justifyContent: 'center' }}>
              <span className="gc-name">{t('g_notSure')}</span>
            </button>
          </div>
          <p className="picked-roles" aria-live="polite">{picked.length ? t('g_picked', { roles: pickedRoles }) : ''}</p>
        </main>
        <ActionBar hint={picked.length === 2 ? t('g_replace') : undefined}>
          <button className="btn btn-primary btn-block" disabled={!notSure && picked.length === 0} onClick={() => { setStage(1); timer.current.reset(); }}>{t('next')}</button>
        </ActionBar>
      </>
    );
  }

  if (stage <= singles.length) {
    const item = singles[stage - 1];
    return (
      <>
        {header}
        <main className="content enter" key={item.item_id}>
          <p className="eyebrow muted">{t('questionOf', { n: stage + 1, total })}</p>
          <h1 className="q-text" id={`q-${item.item_id}`}>{item.text_en}</h1>
          <div className="choices" role="radiogroup" aria-labelledby={`q-${item.item_id}`}>
            {item.options!.map((o) => (
              <Choice key={o.value} label={o.label_en} selected={answers[item.field] === o.value}
                onSelect={() => { setAnswers({ ...answers, [item.field]: o.value }); setTimeout(() => setStage(stage + 1), 160); }} />
            ))}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {header}
      <main className="content enter">
        <p className="eyebrow muted">{t('questionOf', { n: total, total })} · {t('optional')}</p>
        <div className="question">
          <label className="q-text" htmlFor="note">{noteItem?.text_en}</label>
          <p className="q-help"><HelpCircle size={14} style={{ verticalAlign: '-2px' }} /> {noteItem?.help_en}</p>
        </div>
        <textarea id="note" className="textarea" value={note} maxLength={noteItem?.max_length ?? 500} onChange={(e) => setNote(e.target.value)} placeholder={t('g_notePh')} />
        <p className="field-help" style={{ textAlign: 'right' }}>{note.length} / {noteItem?.max_length ?? 500}</p>
      </main>
      <ActionBar>
        <button className="btn btn-primary btn-block" disabled={busy} onClick={submit}>{busy ? t('saving') : editing ? t('g_saveUpdate') : t('g_finish')}</button>
      </ActionBar>
    </>
  );
}
