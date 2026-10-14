import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, screenTimer } from '../api';
import { ActionBar, AppBar, Choice, choicesClass, Loading, Stories } from '../components/ui';
import { useI18n } from '../i18n';
import { useLearner, useToast } from '../state';
import type { ProfileItem } from '../types';

/** L03 About you: one question per screen, saved after each answer, single choices advance on tap.
 *  Long option lists switch to two columns or tighter rows so every question fits one screen. */
export default function About() {
  const nav = useNavigate();
  const toast = useToast();
  const { progress, refresh } = useLearner();
  const [items, setItems] = useState<ProfileItem[] | null>(null);
  const [states, setStates] = useState<{ value: string; label: string }[]>([]);
  const { t, lang } = useI18n();
  const positioned = useRef(false);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef(screenTimer());

  useEffect(() => {
    // Reloads when the language changes; the position is set only the first time.
    api.get<{ items: ProfileItem[]; states: { value: string; label: string }[] }>('/assessment/items?part=A').then((r) => {
      setItems(r.items);
      setStates(r.states);
      if (!positioned.current) {
        positioned.current = true;
        const next = r.items.findIndex((i) => i.item_id === progress?.next_part_a_item);
        setIndex(next >= 0 ? next : 0);
      }
    }).catch((e) => toast(e.message, 'error'));
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const item = items?.[index];
  // Start each screen from the stored answer so going back shows what was chosen.
  useEffect(() => {
    if (!item || !progress) return;
    const p = progress.profile;
    setDraft({ [item.field]: p[item.field] ?? (item.type === 'multi' ? [] : item.type === 'state_district' ? { state: '', district: '' } : undefined), ...(item.sub_question ? { [item.sub_question.field]: p[item.sub_question.field] } : {}) });
    timer.current.reset();
  }, [item?.item_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (answers: Record<string, any>) => {
    if (!item || !items) return;
    setBusy(true);
    try {
      await api.patch(`/learners/${progress!.learner_id}`, { item_id: item.item_id, answers, ms_taken: timer.current.elapsed() });
      setSaved(true);
      const p = await refresh();
      if (index + 1 < items.length) setIndex(index + 1);
      else nav(p && p.step !== 'about' ? '/journey/profile' : '/journey/about', { replace: true });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('couldNotSave'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => (index > 0 ? setIndex(index - 1) : nav('/'));
  const fraction = items ? index / items.length : 0;
  const value = item ? draft[item.field] : undefined;

  const footer = useMemo(() => {
    if (!item) return null;
    if (item.type === 'single' && !item.required) {
      return <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => save({ [item.field]: null })}>{t('skip')}</button>;
    }
    if (item.type === 'multi') {
      return <button className="btn btn-primary btn-block" disabled={busy || !value?.length} onClick={() => save({ [item.field]: value })}>{t('next')}</button>;
    }
    if (item.type === 'state_district') {
      const ok = value?.state && value?.district?.trim().length >= 2;
      return <button className="btn btn-primary btn-block" disabled={busy || !ok} onClick={() => save({ [item.field]: { state: value.state, district: value.district.trim() } })}>{t('next')}</button>;
    }
    return null;
  }, [item, value, busy, t]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!items || !progress || !item) return <><AppBar title={t('part_about')} back="/" /><Loading /></>;

  return (
    <>
      <AppBar title={t('part_about')} onBack={onBack} />
      <Stories part={0} fraction={fraction} saved={saved} />
      <main className="content enter" key={item.item_id}>
        <p className="eyebrow muted">{t('questionOf', { n: index + 1, total: items.length })}</p>
        <div className="question">
          <h1 className="q-text" id={`q-${item.item_id}`}>{item.text_en}</h1>
          {item.help_en ? <p className="q-help">{item.help_en}</p> : null}
        </div>

        {item.type === 'single' && (
          <div className={choicesClass(item.options!.map((o) => o.label_en))} role="radiogroup" aria-labelledby={`q-${item.item_id}`}>
            {item.options!.map((o) => (
              <Choice key={o.value} label={o.label_en} selected={value === o.value} disabled={busy}
                onSelect={() => { setDraft({ [item.field]: o.value }); save({ [item.field]: o.value }); }} />
            ))}
          </div>
        )}

        {item.type === 'multi' && (
          <div className={choicesClass([...item.options!, item.none_option].filter(Boolean).map((o) => o!.label_en))} role="group" aria-labelledby={`q-${item.item_id}`}>
            {item.options!.map((o) => {
              const on = (value ?? []).includes(o.value);
              return <Choice key={o.value} multi label={o.label_en} selected={on}
                onSelect={() => setDraft({ [item.field]: on ? value.filter((x: string) => x !== o.value) : [...(value ?? []).filter((x: string) => x !== item.none_option?.value), o.value] })} />;
            })}
            {item.none_option && (
              <Choice multi label={item.none_option.label_en} selected={(value ?? []).includes(item.none_option.value)}
                onSelect={() => setDraft({ [item.field]: [item.none_option!.value] })} />
            )}
          </div>
        )}

        {item.type === 'state_district' && (
          <div className="stack">
            <div className="field">
              <label htmlFor="state">{t('a_state')}</label>
              <select id="state" className="select" value={value?.state ?? ''} onChange={(e) => setDraft({ [item.field]: { ...value, state: e.target.value } })}>
                <option value="">{t('a_statePh')}</option>
                {states.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="district">{t('a_district')}</label>
              <input id="district" className="input" autoComplete="address-level2" value={value?.district ?? ''} maxLength={80} onChange={(e) => setDraft({ [item.field]: { ...value, district: e.target.value } })} placeholder={t('a_districtPh')} />
            </div>
          </div>
        )}

        {item.type === 'experience' && (
          <>
            <div className="choices dense" role="radiogroup" aria-labelledby={`q-${item.item_id}`}>
              {item.options!.map((o) => (
                <Choice key={o.value} label={o.label_en} selected={value === o.value} disabled={busy}
                  onSelect={() => {
                    const next = { ...draft, [item.field]: o.value };
                    setDraft(next);
                    if (item.sub_question!.skip_when.includes(o.value)) save({ [item.field]: o.value });
                  }} />
              ))}
            </div>
            {value && !item.sub_question!.skip_when.includes(value) && (
              <div className="stack enter">
                <h2 id="q-role" style={{ fontSize: 'var(--fs-lg)' }}>{item.sub_question!.text_en}</h2>
                <div className="choices dense" role="radiogroup" aria-labelledby="q-role">
                  {item.sub_question!.options.map((o) => (
                    <Choice key={o.value} label={o.label_en} selected={draft[item.sub_question!.field] === o.value} disabled={busy}
                      onSelect={() => { setDraft({ ...draft, [item.sub_question!.field]: o.value }); save({ [item.field]: value, [item.sub_question!.field]: o.value }); }} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {busy ? <p className="sr-only" aria-live="polite">{t('saving')}</p> : null}
      </main>
      {footer ? <ActionBar>{footer}</ActionBar> : null}
    </>
  );
}
