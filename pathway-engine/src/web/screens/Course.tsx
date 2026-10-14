/** L15 Course detail: outcome, level, hours, then tabs for what you study, skills, and what comes before and after. Fits one screen. */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, KeyRound, ListChecks, Target } from 'lucide-react';
import { api, ApiError } from '../api';
import { AppBar, ErrorNote, Loading } from '../components/ui';
import { fmtLevel } from '../journey';
import { useI18n } from '../i18n';

interface CourseDetail {
  course_id: string; title: string; series: string; nsqf_label: string;
  hours: { training: number; assessment: number; total: number } | null; terminal_outcome: string; pitched_at: string | null;
  modules: string[]; assessment_gate: string | null;
  skills: { skill_id: string; name: string; definition: string; level_out: number; primary: boolean }[];
  prerequisites: { hard: { course_id: string; title: string }[]; soft: { course_id: string; title: string }[]; entry_level: number };
  unlocks: { course_id: string; title: string }[];
}
type Tab = 'study' | 'skills' | 'before';

export default function Course() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t, lang } = useI18n();
  const [c, setC] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('study');
  useEffect(() => { api.get<CourseDetail>(`/courses/${id}`).then(setC).catch((e: ApiError) => setError(e.message)); }, [id, lang]);
  const back = () => (window.history.length > 1 ? nav(-1) : nav('/app'));
  if (error) return <><AppBar title={t('co_course')} onBack={back} /><div className="content"><ErrorNote>{error}</ErrorNote></div></>;
  if (!c) return <><AppBar title={t('co_course')} onBack={back} /><Loading /></>;
  const weekly = c.hours ? Math.max(0.5, Math.round((c.hours.total / 26) * 2) / 2) : null;
  const list = (xs: { title: string }[]) => xs.map((x) => x.title).join(', ');
  return (
    <>
      <AppBar title={c.series} sub={t('co_course')} onBack={back} />
      <main className="content enter" style={{ gap: 12 }}>
        <div className="stack" style={{ gap: 4 }}>
          <h1 style={{ fontSize: 22 }}>{c.title}</h1>
          <p className="sub">{c.nsqf_label}</p>
        </div>
        <div className="card soft tight row" style={{ alignItems: 'flex-start' }}>
          <span className="tile"><Target size={20} strokeWidth={1.75} /></span>
          <div><p className="label">{t('co_after')}</p><p className="small">{t('co_afterBody', { outcome: c.terminal_outcome })}</p></div>
        </div>
        <div className="chips">
          {c.hours ? <span className="chip"><Clock size={13} /> {t('co_hours', { h: c.hours.total })}</span> : null}
          {weekly ? <span className="chip">{t('co_weekly', { w: weekly })}</span> : null}
          {c.pitched_at ? <span className="chip">{t('co_for', { x: c.pitched_at })}</span> : null}
        </div>
        <div className="subtabs" role="tablist">
          {([['study', 'co_tabStudy'], ['skills', 'co_tabSkills'], ['before', 'co_tabBefore']] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{t(label)}</button>
          ))}
        </div>
        {tab === 'study' && (
          <div className="stack" style={{ gap: 6 }}>
            <ol className="rows" style={{ paddingLeft: 0 }}>
              {c.modules.map((m, i) => <li key={m}><span className="term-dot planned" style={{ position: 'static', flex: 'none' }}>{i + 1}</span><span className="grow small" style={{ fontWeight: 600 }}>{m}</span></li>)}
            </ol>
            {c.assessment_gate ? <p className="sub"><ListChecks size={14} style={{ verticalAlign: '-2px' }} /> {t('co_toPass', { g: c.assessment_gate })}</p> : null}
          </div>
        )}
        {tab === 'skills' && (
          <div className="chips">
            {[...c.skills].sort((a, b) => Number(b.primary) - Number(a.primary)).map((s) => (
              <span key={s.skill_id} className="chip" title={s.definition} style={s.primary ? { background: 'var(--blue-50)' } : undefined}>{s.name} <span className="mono">{t('co_to', { n: fmtLevel(s.level_out) })}</span></span>
            ))}
          </div>
        )}
        {tab === 'before' && (
          <div className="stack" style={{ gap: 10 }}>
            {c.prerequisites.hard.length
              ? <p className="small">{t('co_finishFirst', { list: list(c.prerequisites.hard), n: fmtLevel(c.prerequisites.entry_level) })}</p>
              : <p className="small"><CheckCircle2 size={14} style={{ verticalAlign: '-2px', color: 'var(--success)' }} /> {t('co_noEarlier')}</p>}
            {c.prerequisites.soft.length ? <p className="sub">{t('co_helps', { list: list(c.prerequisites.soft) })}</p> : null}
            {c.unlocks.length ? <div><p className="label">{t('co_opens')}</p>{c.unlocks.map((u) => <p key={u.course_id} className="small row"><KeyRound size={14} /> {u.title}</p>)}</div> : null}
          </div>
        )}
      </main>
    </>
  );
}
