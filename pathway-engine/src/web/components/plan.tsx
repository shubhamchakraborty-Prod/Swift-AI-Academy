/**
 * Pathway pieces shared by the results screen (L14) and the home tabs.
 * The overview fits one phone screen: compact term cards, then rows that open bottom sheets for
 * the full reasons, every skill gained and how it helps, and skills to build elsewhere.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, BookOpen, ChevronRight, Clock, Compass, Info, KeyRound, Layers, Mountain } from 'lucide-react';
import { fmtDate, fmtLevel } from '../journey';
import { useI18n } from '../i18n';
import type { StrKey } from '../strings';
import type { Results, SkillGained, Term } from '../types';
import { LevelMeter, Segmented, Sheet } from './ui';

const STATUS: Record<Term['status'], { key: StrKey; tone: string }> = {
  planned: { key: 'st_planned', tone: 'plain' },
  active: { key: 'st_active', tone: '' },
  passed: { key: 'st_passed', tone: 'success' },
  failed: { key: 'st_failed', tone: 'warning' },
};

/** One skill: plain meaning, how far the plan takes it, and where it is used. */
export function SkillRow({ s, compact }: { s: SkillGained; compact?: boolean }) {
  const { t, lang } = useI18n();
  const mine = s.helps.filter((h) => h.in_your_plan);
  const others = s.helps.filter((h) => !h.in_your_plan);
  const joinGoals = (xs: string[]) => (xs.length <= 1 ? xs[0] ?? '' : `${xs.slice(0, -1).join(', ')} ${lang === 'hi' ? 'और' : 'and'} ${xs[xs.length - 1]}`);
  const roles = (r: string[]) => r.map((x) => (lang === 'en' ? x.toLowerCase() : x)).join(lang === 'hi' ? ' और ' : ' and ');
  return (
    <li className="stack" style={{ gap: 6, alignItems: 'stretch' }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow"><span className="title">{s.name}</span>{compact ? null : <p className="sub">{s.definition}</p>}</div>
        <span className="pill navy mono" aria-label={`${fmtLevel(s.from)} → ${fmtLevel(s.to)}`}>{fmtLevel(s.from)} → {fmtLevel(s.to)}</span>
      </div>
      <LevelMeter have={s.from} gain={s.to} label={`${fmtLevel(s.from)} → ${fmtLevel(s.to)} / 8`} />
      {mine.length ? <p className="sub"><strong style={{ color: 'var(--navy)' }}>{t('sk_used', { goals: joinGoals(mine.map((h) => h.goal_name)), roles: roles(mine[0].roles) })}</strong></p>
        : others.length ? <p className="sub">{t('sk_also', { goals: joinGoals(others.map((h) => h.goal_name)), roles: roles(others[0].roles) })}</p> : null}
    </li>
  );
}

/** Skills used in the learner's own kinds of work come first. */
const sortSkills = (xs: SkillGained[]) => [...xs].sort((a, b) => Number(b.helps.some((h) => h.in_your_plan)) - Number(a.helps.some((h) => h.in_your_plan)));

export function SkillList({ skills }: { skills: SkillGained[] }) {
  return <ul className="rows" style={{ gap: 4 }}>{sortSkills(skills).map((s) => <SkillRow key={s.skill_id} s={s} />)}</ul>;
}

/** Full details of one term, shown in a bottom sheet. */
function TermDetails({ t: term, goals }: { t: Term; goals: Results['goals'] }) {
  const { t, locale } = useI18n();
  const helps = goals.filter((g) => term.goal_areas.includes(g.goal_id));
  return (
    <div className="stack" style={{ gap: 14 }}>
      <p className="small muted">{term.nsqf_label}{term.hours_total ? ` · ${t('t_hours', { h: term.hours_total })}` : ''}</p>
      {term.starts_on ? <p className="small"><Clock size={14} style={{ verticalAlign: '-2px' }} /> {fmtDate(term.starts_on, locale)} – {term.ends_on ? fmtDate(term.ends_on, locale) : ''}</p> : null}
      <p>{term.sentence}</p>
      {helps.length ? <div className="chips"><span className="small muted">{t('t_helps')}:</span>{helps.map((g) => <span key={g.goal_id} className="chip">{g.name}</span>)}</div> : null}
      {term.unlocks ? <p className="small"><KeyRound size={14} style={{ verticalAlign: '-2px' }} /> {t('t_opens', { title: term.unlocks.title })}</p> : null}
      {term.warnings.map((w) => <div key={w} className="banner warning small"><AlertTriangle size={18} />{w}</div>)}
      <SkillList skills={term.skills_gained} />
      <Link className="btn btn-secondary btn-block" to={`/course/${term.course_id}`}><BookOpen size={18} /> {t('t_details')}</Link>
    </div>
  );
}

/** Compact card for one term: months, status, title and the main skills. Tap for everything else. */
export function TermMini({ term, goals }: { term: Term; goals: Results['goals'] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [a, b] = term.months.split('-');
  const st = STATUS[term.status];
  return (
    <>
      <button type="button" className="term-mini" onClick={() => setOpen(true)} aria-label={`${t('t_months', { a, b })}: ${term.title}. ${t('t_tapMore')}`}>
        <span className={`term-dot ${term.status === 'passed' ? 'done' : term.status === 'planned' ? 'planned' : ''}`} aria-hidden="true">{term.term_no}</span>
        <span className="grow stack" style={{ gap: 4 }}>
          <span className="row" style={{ gap: 8 }}>
            <span className="eyebrow" style={{ fontSize: 10.5 }}>{t('t_months', { a, b })}</span>
            <span className="spacer" />
            <span className={`pill ${st.tone}`} style={{ fontSize: 11, padding: '2px 8px' }}>{t(st.key)}</span>
          </span>
          <span className="title" style={{ fontSize: 16 }}>{term.title}</span>
          <span className="chips one-line">
            {term.reason_skills.slice(0, 2).map((s) => <span key={s.skill_id} className="chip"><span className="clamp1">{s.name}</span> <span className="mono">{fmtLevel(s.from)}→{fmtLevel(s.to)}</span></span>)}
          </span>
        </span>
        <ChevronRight size={20} style={{ alignSelf: 'center', color: 'var(--muted)' }} />
      </button>
      {open ? <Sheet title={term.title} onClose={() => setOpen(false)}><TermDetails t={term} goals={goals} /></Sheet> : null}
    </>
  );
}

/** A row that opens a bottom sheet. */
function SheetRow({ icon, title, sub, tone, sheetTitle, children }: { icon: React.ReactNode; title: string; sub?: string; tone?: string; sheetTitle: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="row-btn card tight" onClick={() => setOpen(true)}>
        <span className={`tile ${tone ?? ''}`}>{icon}</span>
        <span className="grow"><span className="title">{title}</span>{sub ? <><br /><span className="sub">{sub}</span></> : null}</span>
        <ChevronRight size={20} style={{ color: 'var(--muted)' }} />
      </button>
      {open ? <Sheet title={sheetTitle} onClose={() => setOpen(false)}>{children}</Sheet> : null}
    </>
  );
}

export function SkillsGainedRow({ r }: { r: Results }) {
  const { t } = useI18n();
  if (!r.pathway.skills_gained.length) return null;
  const n = r.pathway.skills_gained.length;
  return (
    <SheetRow icon={<Layers size={20} strokeWidth={1.75} />} title={t('sk_after', { m: r.pathway.length_months })} sub={t('sk_seeAll', { n })} sheetTitle={t('sk_after', { m: r.pathway.length_months })}>
      <p className="small muted" style={{ marginBottom: 8 }}>{t('sk_levels')}</p>
      <SkillList skills={r.pathway.skills_gained} />
    </SheetRow>
  );
}

export function BuildElsewhereRow({ r }: { r: Results }) {
  const { t } = useI18n();
  if (!r.build_elsewhere.length) return null;
  return (
    <SheetRow icon={<Mountain size={20} strokeWidth={1.75} />} tone="gold" title={t('be_row', { n: r.build_elsewhere.length })} sheetTitle={t('be_title')}>
      <p className="small muted" style={{ marginBottom: 8 }}>{r.templates.build_elsewhere}</p>
      <ul className="rows">{r.build_elsewhere.map((b) => <li key={b.skill_id}><span className="grow title">{b.name}</span><span className="pill gold mono">{t('be_to', { n: fmtLevel(b.needed) })}</span></li>)}</ul>
    </SheetRow>
  );
}

export function ExploreRow({ r }: { r: Results }) {
  const { t } = useI18n();
  if (!r.explore_option) return null;
  return (
    <Link to={`/course/${r.explore_option.course_id}`} className="row-btn card tight" style={{ textDecoration: 'none' }}>
      <span className="tile gold"><ArrowUpRight size={20} strokeWidth={1.75} /></span>
      <span className="grow"><span className="sub">{t('ex_title')}</span><br /><span className="title">{r.explore_option.title}</span></span>
      <ChevronRight size={20} style={{ color: 'var(--muted)' }} />
    </Link>
  );
}

export function TermList({ r }: { r: Results }) {
  if (!r.pathway.terms.length) return <div className="banner warning"><AlertTriangle size={20} /><span>{r.templates.no_course}</span></div>;
  return <div className="stack" style={{ gap: 8 }}>{r.pathway.terms.map((term) => <TermMini key={term.term_no} term={term} goals={r.goals} />)}</div>;
}

/** L14 body: length switch, one-line summary, the terms, then rows that open details. */
export function PlanOverview({ r, onLength, busyLength }: { r: Results; onLength?: (m: 6 | 12) => void; busyLength?: boolean }) {
  const { t } = useI18n();
  return (
    <section className="stack" style={{ gap: 8 }}>
      {onLength && r.pathway.can_change_length ? (
        <Segmented label={t('r_plan')} value={r.pathway.length_months} onChange={(m) => !busyLength && onLength(m)} options={[{ value: 6, label: t('r_len6') }, { value: 12, label: t('r_len12') }]} />
      ) : null}
      {r.pathway.summary ? <p className="small clamp2" style={{ color: 'var(--navy)', fontWeight: 600 }}>{r.pathway.summary}</p> : null}
      {r.pathway.exploring_note ? <p className="sub"><Compass size={14} style={{ verticalAlign: '-2px' }} /> {r.pathway.exploring_note}</p> : null}
      {r.pathway.shortened && r.pathway.terms.length === 1 && r.pathway.length_months === 12 ? <p className="sub"><Info size={14} style={{ verticalAlign: '-2px' }} /> {r.templates.shorter_pathway}</p> : null}
      {r.pathway.default_length === '6_then_extend' && r.pathway.length_months === 6 && onLength ? <p className="sub">{t('r_extendNote')}</p> : null}
      <TermList r={r} />
      <SkillsGainedRow r={r} />
      <BuildElsewhereRow r={r} />
      <ExploreRow r={r} />
    </section>
  );
}
