/**
 * Pathway pieces reused by the results screen (L14) and the dashboard: term cards,
 * "skills you will build" with how each skill helps, build-elsewhere list and the explore option.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, BookOpen, ChevronDown, ChevronUp, Clock, KeyRound, Layers } from 'lucide-react';
import { fmtDate, fmtLevel } from '../journey';
import type { Results, SkillGained, Term } from '../types';
import { LevelMeter } from './ui';

const STATUS: Record<Term['status'], { label: string; tone: string }> = {
  planned: { label: 'Planned', tone: 'plain' },
  active: { label: 'In progress', tone: '' },
  passed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Not passed', tone: 'warning' },
};

/** One skill, what it means, how far the plan takes it, and where it is used. */
export function SkillRow({ s }: { s: SkillGained }) {
  const mine = s.helps.filter((h) => h.in_your_plan);
  const others = s.helps.filter((h) => !h.in_your_plan);
  const fmtRoles = (r: string[]) => r.map((x) => x.toLowerCase()).join(' and ');
  return (
    <li className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="spacer">
          <strong>{s.name}</strong>
          <p className="small muted">{s.definition}</p>
        </div>
        <span className="pill navy mono" aria-label={`From level ${fmtLevel(s.from)} to level ${fmtLevel(s.to)}`}>{fmtLevel(s.from)} → {fmtLevel(s.to)}</span>
      </div>
      <LevelMeter have={s.from} gain={s.to} label={`Level ${fmtLevel(s.from)} now, level ${fmtLevel(s.to)} after the plan, out of 8`} />
      {mine.length > 0 ? (
        <p className="small"><span className="muted">How it helps: </span>used in {mine.map((h, i) => <span key={h.goal_id}>{i > 0 ? (i === mine.length - 1 ? ' and ' : ', ') : ''}<strong>{h.goal_name}</strong></span>)} roles such as {fmtRoles(mine[0].roles)}.</p>
      ) : others.length > 0 ? (
        <p className="small"><span className="muted">How it helps: </span>also used in {others.map((h) => h.goal_name).join(' and ')} roles such as {fmtRoles(others[0].roles)}.</p>
      ) : null}
    </li>
  );
}

export function SkillsGained({ skills, initial = 5, title = 'Skills you will build' }: { skills: SkillGained[]; initial?: number; title?: string }) {
  const [all, setAll] = useState(false);
  if (!skills.length) return null;
  // Skills used in the learner's own kinds of work come first.
  const sorted = [...skills].sort((a, b) => Number(b.helps.some((h) => h.in_your_plan)) - Number(a.helps.some((h) => h.in_your_plan)));
  const shown = all ? sorted : sorted.slice(0, initial);
  return (
    <section className="card stack" aria-label={title}>
      <div className="row"><span className="tile"><Layers size={20} strokeWidth={1.75} /></span><div><h3>{title}</h3><p className="small muted">Levels run from 0 to 8. Each course is designed against NSQF level descriptors.</p></div></div>
      <ul className="list">{shown.map((s) => <SkillRow key={s.skill_id} s={s} />)}</ul>
      {sorted.length > initial ? (
        <button className="btn btn-ghost" onClick={() => setAll(!all)} aria-expanded={all}>
          {all ? <>Show fewer <ChevronUp size={18} /></> : <>Show all {sorted.length} skills <ChevronDown size={18} /></>}
        </button>
      ) : null}
    </section>
  );
}

export function TermCard({ t, goals, compact }: { t: Term; goals: Results['goals']; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(!compact);
  const st = STATUS[t.status];
  const helps = goals.filter((g) => t.goal_areas.includes(g.goal_id));
  return (
    <article className="term" aria-label={`Months ${t.months}: ${t.title}`}>
      <span className={`term-dot ${t.status === 'passed' ? 'done' : t.status === 'planned' ? 'planned' : ''}`} aria-hidden="true">{t.term_no}</span>
      <div className="card raised stack">
        <div className="row wrap">
          <span className="eyebrow">Months {t.months.replace('-', ' to ')}</span>
          <span className="spacer" />
          <span className={`pill ${st.tone}`}>{st.label}</span>
        </div>
        <div>
          <h3>{t.title}</h3>
          <p className="small muted">{t.nsqf_label}{t.hours_total ? ` · About ${t.hours_total} hours over 6 months` : ''}</p>
        </div>
        {more ? <p>{t.sentence}</p> : null}
        {t.starts_on ? <p className="small"><Clock size={14} style={{ verticalAlign: '-2px' }} /> {fmtDate(t.starts_on)} to {t.ends_on ? fmtDate(t.ends_on) : ''}</p> : null}
        <div className="stack" style={{ gap: 6 }}>
          <p className="label">Main skills it builds for you</p>
          <ul className="list">
            {t.reason_skills.map((s) => (
              <li key={s.skill_id} className="row"><span className="spacer">{s.name}</span><span className="pill navy mono">{fmtLevel(s.from)} → {fmtLevel(s.to)}</span></li>
            ))}
          </ul>
        </div>
        {more && helps.length ? <div className="row wrap"><span className="small muted">Helps in:</span>{helps.map((g) => <span key={g.goal_id} className="pill plain">{g.name}</span>)}</div> : null}
        {more && t.unlocks ? <p className="small"><KeyRound size={14} style={{ verticalAlign: '-2px' }} /> Opens the way to <strong>{t.unlocks.title}</strong></p> : null}
        {t.warnings.map((w) => <div key={w} className="banner warning small"><AlertTriangle size={18} />{w}</div>)}
        {open ? (
          <ul className="list enter">{t.skills_gained.map((s) => <SkillRow key={s.skill_id} s={s} />)}</ul>
        ) : null}
        <div className="row wrap">
          {!more ? <button className="btn btn-ghost btn-sm" onClick={() => setMore(true)} aria-expanded={more}>Why this course</button> : null}
          {more && t.skills_gained.length > t.reason_skills.length ? (
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide skills' : `All ${t.skills_gained.length} skills and how they help`}</button>
          ) : null}
          <span className="spacer" />
          <Link className="btn btn-secondary btn-sm" to={`/course/${t.course_id}`}><BookOpen size={16} /> Course details</Link>
        </div>
      </div>
    </article>
  );
}

export function BuildElsewhere({ r }: { r: Results }) {
  if (!r.build_elsewhere.length) return null;
  return (
    <section className="card soft stack" aria-label="Build elsewhere">
      <h3>Skills to build elsewhere</h3>
      <p className="small muted">{r.templates.build_elsewhere}</p>
      <ul className="list">
        {r.build_elsewhere.map((b) => (
          <li key={b.skill_id} className="row"><span className="spacer">{b.name}</span><span className="pill gold mono">to level {fmtLevel(b.needed)}</span></li>
        ))}
      </ul>
    </section>
  );
}

export function ExploreOption({ r }: { r: Results }) {
  if (!r.explore_option) return null;
  return (
    <Link to={`/course/${r.explore_option.course_id}`} className="card row" style={{ textDecoration: 'none', color: 'inherit' }}>
      <span className="tile gold"><ArrowUpRight size={20} strokeWidth={1.75} /></span>
      <span className="spacer"><span className="eyebrow muted">Another direction to explore</span><br /><strong>{r.explore_option.title}</strong><br /><span className="small muted">Could help if you lean towards {r.explore_option.goal_name}.</span></span>
    </Link>
  );
}

export function Timeline({ r, compact }: { r: Results; compact?: boolean }) {
  if (!r.pathway.terms.length) {
    return <div className="banner warning"><AlertTriangle size={20} /><span>{r.templates.no_course}</span></div>;
  }
  return (
    <div className="timeline">
      {r.pathway.terms.map((t) => <TermCard key={t.term_no} t={t} goals={r.goals} compact={compact} />)}
    </div>
  );
}
