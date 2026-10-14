/**
 * Home after the plan is accepted, with a bottom tab bar (like WhatsApp or Instagram):
 *   Plan   status, compact terms (tap for details), L16 update banner, add or drop the second course
 *   Skills what the plan builds and what the learner's directions need (top items, "see all" in a sheet)
 *   You    learner type, results, update goals, retake, sign out, delete data
 * Every tab fits one phone screen.
 */
import { useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { BarChart3, BellRing, CalendarClock, ChevronRight, Compass, Layers, LogOut, Map, PlusCircle, RefreshCw, Target, Trash2, Undo2, UserRound } from 'lucide-react';
import { api, ApiError } from '../api';
import { AppBar, BrandBar, ErrorNote, Loading, Segmented, Sheet } from '../components/ui';
import { BuildElsewhereRow, SkillList, SkillRow, TermList } from '../components/plan';
import { fmtDate } from '../journey';
import { useLearner, useToast } from '../state';
import { useI18n } from '../i18n';
import type { Results } from '../types';
import { Gaps, PersonaCard, useResults } from './Results';

function TabBar() {
  const { t } = useI18n();
  return (
    <nav className="tabbar" aria-label="Main">
      <NavLink to="/app" end><Map size={22} strokeWidth={1.75} />{t('d_plan')}</NavLink>
      <NavLink to="/app/skills"><Layers size={22} strokeWidth={1.75} />{t('d_skills')}</NavLink>
      <NavLink to="/app/you"><UserRound size={22} strokeWidth={1.75} />{t('d_you')}</NavLink>
    </nav>
  );
}

function StatusCard({ r }: { r: Results }) {
  const { t, locale } = useI18n();
  const active = r.pathway.terms.find((x) => x.status === 'active');
  const first = r.pathway.terms.find((x) => x.status === 'planned');
  const term = active ?? first;
  if (!term) return null;
  return (
    <div className="card tight row" style={{ alignItems: 'flex-start' }}>
      <span className={`tile ${active ? 'success' : 'gold'}`}><CalendarClock size={20} strokeWidth={1.75} /></span>
      <div className="grow">
        <p className="sub">{active ? t('d_now') : t('d_next')}</p>
        <p className="title">{term.title}</p>
        <p className="sub">{active && active.ends_on ? t('d_until', { date: fmtDate(active.ends_on, locale) }) : t('d_nextBody')}</p>
      </div>
    </div>
  );
}

function PlanTab({ r, setR }: { r: Results; setR: (r: Results) => void }) {
  const { progress } = useLearner();
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const setLength = async (m: 6 | 12) => {
    setBusy(true);
    try { setR(await api.post<Results>(`/learners/${progress!.learner_id}/pathway`, { length_months: m })); toast(m === 12 ? t('d_added') : t('d_to6')); }
    catch (e) { toast(e instanceof ApiError ? e.message : t('errorGeneric'), 'error'); }
    finally { setBusy(false); }
  };
  const dismiss = async () => {
    setR({ ...r, banner: null });
    await api.post(`/learners/${progress!.learner_id}/pathway/banner/dismiss`).catch(() => undefined);
  };
  const locked = r.pathway.terms.some((x) => x.locked);
  return (
    <main className="content enter" style={{ gap: 12 }}>
      <div className="stack" style={{ gap: 2 }}>
        {progress?.first_name ? <p className="eyebrow">{t('d_hi', { name: progress.first_name })}</p> : null}
        <h1 style={{ fontSize: 24 }}>{t('d_title', { m: r.pathway.length_months })}</h1>
      </div>
      {r.banner ? (
        <div className="banner gold small" role="status">
          <BellRing size={18} />
          <div className="grow stack" style={{ gap: 4 }}>
            <strong>{r.banner.message}</strong>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{r.banner.changes.map((c) => <li key={c}>{c}</li>)}</ul>
            <button className="link-btn small" style={{ alignSelf: 'flex-start' }} onClick={dismiss}>{t('d_gotIt')}</button>
          </div>
        </div>
      ) : null}
      {r.status === 'proposed' ? (
        <Link to="/results/plan" className="banner" style={{ textDecoration: 'none', color: 'inherit' }}><Compass size={20} /><span className="grow">{t('d_ready')}</span><ChevronRight size={20} /></Link>
      ) : <StatusCard r={r} />}
      <TermList r={r} />
      <p className="sub"><strong style={{ color: 'var(--navy)' }}>{r.persona.name}.</strong> {r.persona.meaning}</p>
      {r.pathway.can_change_length && r.status !== 'proposed' ? (
        r.pathway.length_months === 6 ? (
          <button className="btn btn-secondary btn-block" disabled={busy} onClick={() => setLength(12)}><PlusCircle size={18} /> {t('d_add')}</button>
        ) : !locked ? (
          <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => setLength(6)}><Undo2 size={18} /> {t('d_keep')}</button>
        ) : null
      ) : null}
    </main>
  );
}

function SkillsTab({ r }: { r: Results }) {
  const { t } = useI18n();
  const [view, setView] = useState<'build' | 'need'>('build');
  const [all, setAll] = useState(false);
  const skills = [...r.pathway.skills_gained].sort((a, b) => Number(b.helps.some((h) => h.in_your_plan)) - Number(a.helps.some((h) => h.in_your_plan)));
  return (
    <main className="content enter" style={{ gap: 12 }}>
      <h1 style={{ fontSize: 24 }}>{t('d_skillsTitle')}</h1>
      <Segmented label={t('d_skillsTitle')} value={view} onChange={setView} options={[{ value: 'build', label: t('d_build') }, { value: 'need', label: t('d_need') }]} />
      {view === 'build' ? (
        <>
          <ul className="rows card tight">{skills.slice(0, 3).map((s) => <SkillRow key={s.skill_id} s={s} compact />)}</ul>
          {skills.length > 3 ? <button className="btn btn-ghost" onClick={() => setAll(true)}>{t('d_seeAll', { n: skills.length })}</button> : null}
          {all ? <Sheet title={t('sk_after', { m: r.pathway.length_months })} onClose={() => setAll(false)}><SkillList skills={r.pathway.skills_gained} /></Sheet> : null}
        </>
      ) : (
        <>
          <Gaps r={r} />
          <BuildElsewhereRow r={r} />
        </>
      )}
    </main>
  );
}

function YouTab({ r }: { r: Results }) {
  const { progress, signOut } = useLearner();
  const { t, locale } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const [sheet, setSheet] = useState<'delete' | 'signout' | null>(null);
  const [busy, setBusy] = useState(false);
  const retake = r.part_b_retake;
  const startRetake = async () => {
    try { await api.post(`/learners/${progress!.learner_id}/assessment/B/retake`); nav('/journey/profile'); }
    catch (e) { toast(e instanceof ApiError ? e.message : t('errorGeneric'), 'error'); }
  };
  const del = async () => {
    setBusy(true);
    try { await api.del(`/learners/${progress!.learner_id}`); signOut(); nav('/', { replace: true }); toast(t('d_deleted')); }
    catch (e) { toast(e instanceof ApiError ? e.message : t('errorGeneric'), 'error'); setBusy(false); }
  };
  const Row = ({ icon, title, sub, onClick, to, danger }: { icon: React.ReactNode; title: string; sub?: string; onClick?: () => void; to?: string; danger?: boolean }) => {
    const inner = (<><span className="tile" style={danger ? { background: 'var(--danger-50)', color: 'var(--danger-700)' } : undefined}>{icon}</span><span className="grow"><span className="title" style={danger ? { color: 'var(--danger-700)' } : undefined}>{title}</span>{sub ? <><br /><span className="sub">{sub}</span></> : null}</span><ChevronRight size={20} style={{ color: 'var(--muted)' }} /></>);
    return <li>{to ? <Link to={to} className="row-btn" style={{ textDecoration: 'none' }}>{inner}</Link> : <button className="row-btn" onClick={onClick}>{inner}</button>}</li>;
  };
  return (
    <main className="content enter" style={{ gap: 12 }}>
      <PersonaCard r={r} compact />
      <ul className="rows card tight">
        <Row icon={<BarChart3 size={20} strokeWidth={1.75} />} title={t('d_youResults')} sub={t('d_youResultsHelp')} to="/results/type" />
        <Row icon={<Target size={20} strokeWidth={1.75} />} title={t('d_goals')} sub={t('d_goalsHelp')} to="/journey/goals?edit=1" />
        {retake.eligible ? <Row icon={<RefreshCw size={20} strokeWidth={1.75} />} title={t('d_retake')} sub={t('d_retakeOk')} onClick={startRetake} />
          : retake.available_at ? <li><span className="row-btn" style={{ cursor: 'default' }}><span className="tile"><RefreshCw size={20} strokeWidth={1.75} /></span><span className="grow"><span className="title">{t('d_retake')}</span><br /><span className="sub">{t('d_retakeFrom', { date: fmtDate(retake.available_at, locale) })}</span></span></span></li> : null}
        <Row icon={<LogOut size={20} strokeWidth={1.75} />} title={t('d_signOut')} onClick={() => setSheet('signout')} />
        <Row icon={<Trash2 size={20} strokeWidth={1.75} />} title={t('d_delete')} onClick={() => setSheet('delete')} danger />
      </ul>
      {sheet === 'delete' && (
        <Sheet title={t('d_delTitle')} onClose={() => setSheet(null)}>
          <p className="lede">{t('d_delBody')}</p>
          <div className="stack" style={{ marginTop: 20 }}>
            <button className="btn btn-danger btn-block" disabled={busy} onClick={del}>{t('d_delete')}</button>
            <button className="btn btn-secondary btn-block" onClick={() => setSheet(null)}>{t('cancel')}</button>
          </div>
        </Sheet>
      )}
      {sheet === 'signout' && (
        <Sheet title={t('d_outTitle')} onClose={() => setSheet(null)}>
          <p className="lede">{t('d_outBody')}</p>
          <div className="stack" style={{ marginTop: 20 }}>
            <button className="btn btn-primary btn-block" onClick={() => { signOut(); nav('/', { replace: true }); }}>{t('d_signOut')}</button>
            <button className="btn btn-secondary btn-block" onClick={() => setSheet(null)}>{t('cancel')}</button>
          </div>
        </Sheet>
      )}
    </main>
  );
}

export default function Dashboard() {
  const { tab = 'plan' } = useParams();
  const nav = useNavigate();
  const { t } = useI18n();
  const { r, setR, error } = useResults();
  if (error) {
    if (error.status === 451) { nav('/guardian', { replace: true }); return null; }
    return <><AppBar title={t('d_plan')} back="/" /><div className="content"><ErrorNote>{error.message}</ErrorNote></div></>;
  }
  return (
    <>
      <BrandBar />
      {!r ? <Loading /> : tab === 'skills' ? <SkillsTab r={r} /> : tab === 'you' ? <YouTab r={r} /> : <PlanTab r={r} setR={setR} />}
      <TabBar />
    </>
  );
}
