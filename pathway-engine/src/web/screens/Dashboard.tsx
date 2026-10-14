/**
 * Home after the plan is accepted, with a bottom tab bar: Plan (status, terms, L16 update banner),
 * Skills (what the plan builds), You (learner type, update goals, retake, sign out, delete data).
 */
import { useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { BellRing, CalendarClock, ChevronRight, Compass, LogOut, Map, PlusCircle, RefreshCw, Target, Trash2, UserRound, Layers, Undo2 } from 'lucide-react';
import { api, ApiError } from '../api';
import { AppBar, Brand, ErrorNote, Loading, Sheet } from '../components/ui';
import { BuildElsewhere, SkillsGained, Timeline } from '../components/plan';
import { fmtDate } from '../journey';
import { useLearner, useToast } from '../state';
import type { Results } from '../types';
import { Gaps, InterestsAndGoals, PersonaCard, useResults } from './Results';

function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      <NavLink to="/app" end><Map size={22} strokeWidth={1.75} />Plan</NavLink>
      <NavLink to="/app/skills"><Layers size={22} strokeWidth={1.75} />Skills</NavLink>
      <NavLink to="/app/you"><UserRound size={22} strokeWidth={1.75} />You</NavLink>
    </nav>
  );
}

function StatusCard({ r }: { r: Results }) {
  const active = r.pathway.terms.find((t) => t.status === 'active');
  const first = r.pathway.terms.find((t) => t.status === 'planned');
  if (active) {
    return (
      <div className="card row" style={{ alignItems: 'flex-start' }}>
        <span className="tile success"><CalendarClock size={20} strokeWidth={1.75} /></span>
        <div><p className="label">Now studying</p><h3>{active.title}</h3>{active.ends_on ? <p className="small muted">Until {fmtDate(active.ends_on)}</p> : null}</div>
      </div>
    );
  }
  if (first) {
    return (
      <div className="card row" style={{ alignItems: 'flex-start' }}>
        <span className="tile gold"><CalendarClock size={20} strokeWidth={1.75} /></span>
        <div><p className="label">Next step</p><h3>{first.title}</h3><p className="small muted">Your institution starts this course at the beginning of the term. It will show as in progress here once it begins.</p></div>
      </div>
    );
  }
  return null;
}

function PlanTab({ r, setR }: { r: Results; setR: (r: Results) => void }) {
  const { progress } = useLearner();
  const toast = useToast();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const setLength = async (m: 6 | 12) => {
    setBusy(true);
    try { setR(await api.post<Results>(`/learners/${progress!.learner_id}/pathway`, { length_months: m })); toast(m === 12 ? 'Second course added to your plan' : 'Plan changed to 6 months'); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Could not change the plan.', 'error'); }
    finally { setBusy(false); }
  };
  const dismiss = async () => {
    setR({ ...r, banner: null });
    await api.post(`/learners/${progress!.learner_id}/pathway/banner/dismiss`).catch(() => undefined);
  };
  const locked = r.pathway.terms.some((t) => t.locked);
  return (
    <main className="content enter">
      <div className="stack" style={{ gap: 4 }}>
        <p className="eyebrow">{progress?.first_name ? `Hi ${progress.first_name}` : 'Your plan'}</p>
        <h1>Your {r.pathway.length_months}-month plan</h1>
      </div>
      {r.banner ? (
        <div className="banner gold" role="status">
          <BellRing size={20} />
          <div className="spacer stack" style={{ gap: 6 }}>
            <strong>{r.banner.message}</strong>
            <ul style={{ margin: 0, paddingLeft: 18 }} className="small">{r.banner.changes.map((c) => <li key={c}>{c}</li>)}</ul>
            <button className="link-btn small" style={{ alignSelf: 'flex-start' }} onClick={dismiss}>Got it</button>
          </div>
        </div>
      ) : null}
      {r.status === 'proposed' ? (
        <Link to="/results/plan" className="banner" style={{ textDecoration: 'none', color: 'inherit' }}><Compass size={20} /><span className="spacer">Your next plan is ready to review.</span><ChevronRight size={20} /></Link>
      ) : <StatusCard r={r} />}
      <div className="card soft"><p className="small"><strong>{r.persona.name}.</strong> {r.persona.meaning}</p></div>
      <Timeline r={r} compact />
      {r.pathway.can_change_length && r.status !== 'proposed' ? (
        r.pathway.length_months === 6 ? (
          <button className="btn btn-secondary btn-block" disabled={busy} onClick={() => setLength(12)}><PlusCircle size={18} /> Add a second course (12 months)</button>
        ) : !locked ? (
          <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => setLength(6)}><Undo2 size={18} /> Keep only the first course (6 months)</button>
        ) : null
      ) : null}
      <button className="btn btn-ghost" onClick={() => nav('/results/type')}>See my full results again</button>
    </main>
  );
}

function SkillsTab({ r }: { r: Results }) {
  return (
    <main className="content enter">
      <div className="stack" style={{ gap: 4 }}><p className="eyebrow">Skills</p><h1>What your plan builds</h1></div>
      <SkillsGained skills={r.pathway.skills_gained} initial={8} title={`After ${r.pathway.length_months} months, you are likely to be able to`} />
      <div className="stack"><h2>Skills your directions need most</h2><Gaps r={r} /></div>
      <BuildElsewhere r={r} />
    </main>
  );
}

function YouTab({ r }: { r: Results }) {
  const { progress, signOut } = useLearner();
  const nav = useNavigate();
  const toast = useToast();
  const [sheet, setSheet] = useState<'delete' | 'signout' | null>(null);
  const [busy, setBusy] = useState(false);
  const retake = r.part_b_retake;
  const startRetake = async () => {
    try { await api.post(`/learners/${progress!.learner_id}/assessment/B/retake`); nav('/journey/profile'); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Could not start the retake.', 'error'); }
  };
  const del = async () => {
    setBusy(true);
    try { await api.del(`/learners/${progress!.learner_id}`); signOut(); nav('/', { replace: true }); toast('Your data has been deleted'); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Could not delete. Try again.', 'error'); setBusy(false); }
  };
  return (
    <main className="content enter">
      <div className="stack" style={{ gap: 4 }}><p className="eyebrow">You</p><h1>{progress?.first_name || 'Your profile'}</h1></div>
      <PersonaCard r={r} />
      <InterestsAndGoals r={r} />
      <section className="card" aria-label="Settings">
        <ul className="list">
          <li><Link to="/journey/goals?edit=1" className="row" style={{ color: 'inherit', textDecoration: 'none' }}><span className="tile"><Target size={20} strokeWidth={1.75} /></span><span className="spacer"><strong>Update my goals</strong><br /><span className="small muted">Your plan updates. Started courses stay as they are.</span></span><ChevronRight size={20} /></Link></li>
          {retake.eligible || retake.available_at ? (
            <li>
              <button className="row" style={{ width: '100%', border: 0, background: 'none', padding: 0, textAlign: 'left', cursor: retake.eligible ? 'pointer' : 'default' }} disabled={!retake.eligible} onClick={startRetake}>
                <span className="tile"><RefreshCw size={20} strokeWidth={1.75} /></span>
                <span className="spacer"><strong>Retake the learning profile</strong><br /><span className="small muted">{retake.eligible ? 'One retake is available.' : `Available from ${fmtDate(retake.available_at!)}.`}</span></span>
                {retake.eligible ? <ChevronRight size={20} /> : null}
              </button>
            </li>
          ) : null}
          <li><button className="row" style={{ width: '100%', border: 0, background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => setSheet('signout')}><span className="tile navy"><LogOut size={20} strokeWidth={1.75} /></span><span className="spacer"><strong>Sign out on this device</strong></span><ChevronRight size={20} /></button></li>
          <li><button className="row" style={{ width: '100%', border: 0, background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'var(--danger-700)' }} onClick={() => setSheet('delete')}><span className="tile" style={{ background: 'var(--danger-50)', color: 'var(--danger-700)' }}><Trash2 size={20} strokeWidth={1.75} /></span><span className="spacer"><strong>Delete my data</strong></span><ChevronRight size={20} /></button></li>
        </ul>
      </section>
      {sheet === 'delete' && (
        <Sheet title="Delete your data?" onClose={() => setSheet(null)}>
          <p className="lede">This removes your answers, results and plan. It cannot be undone. Anonymous records with no name are kept to check the system works fairly.</p>
          <div className="stack" style={{ marginTop: 20 }}>
            <button className="btn btn-danger btn-block" disabled={busy} onClick={del}>Delete my data</button>
            <button className="btn btn-secondary btn-block" onClick={() => setSheet(null)}>Cancel</button>
          </div>
        </Sheet>
      )}
      {sheet === 'signout' && (
        <Sheet title="Sign out on this device?" onClose={() => setSheet(null)}>
          <p className="lede">Your plan stays saved, but this device will no longer open it. Use this only on a shared phone you are giving to someone else.</p>
          <div className="stack" style={{ marginTop: 20 }}>
            <button className="btn btn-primary btn-block" onClick={() => { signOut(); nav('/', { replace: true }); }}>Sign out</button>
            <button className="btn btn-secondary btn-block" onClick={() => setSheet(null)}>Cancel</button>
          </div>
        </Sheet>
      )}
    </main>
  );
}

/** Home after the plan is accepted: three tabs, like any app the learner already uses. */
export default function Dashboard() {
  const { tab = 'plan' } = useParams();
  const nav = useNavigate();
  const { r, setR, error } = useResults();
  if (error) {
    if (error.status === 451) { nav('/guardian', { replace: true }); return null; }
    return <><AppBar title="Your plan" back="/" /><div className="content"><ErrorNote>{error.message}</ErrorNote></div></>;
  }
  return (
    <>
      <header className="appbar" style={{ gridTemplateColumns: '1fr auto' }}><div style={{ paddingLeft: 8 }}><Brand /></div><span /></header>
      {!r ? <Loading label="Loading your plan" /> : tab === 'skills' ? <SkillsTab r={r} /> : tab === 'you' ? <YouTab r={r} /> : <PlanTab r={r} setR={setR} />}
      <TabBar />
    </>
  );
}
