import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BookOpen, CheckCircle2, Clock, KeyRound, ListChecks, Target } from 'lucide-react';
import { api, ApiError } from '../api';
import { AppBar, ErrorNote, LevelMeter, Loading } from '../components/ui';
import { fmtLevel } from '../journey';

interface CourseDetail {
  course_id: string; title: string; series: string; nsqf_label: string;
  hours: { training: number; assessment: number; total: number } | null; terminal_outcome: string; pitched_at: string | null;
  modules: string[]; assessment_gate: string | null;
  skills: { skill_id: string; name: string; definition: string; level_out: number; primary: boolean }[];
  prerequisites: { hard: { course_id: string; title: string }[]; soft: { course_id: string; title: string }[]; entry_level: number };
  unlocks: { course_id: string; title: string }[];
}

/** L15 Course detail: outline, level, hours, skills, what it unlocks. */
export default function Course() {
  const { id } = useParams();
  const nav = useNavigate();
  const [c, setC] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.get<CourseDetail>(`/courses/${id}`).then(setC).catch((e: ApiError) => setError(e.message)); }, [id]);
  const back = () => (window.history.length > 1 ? nav(-1) : nav('/app'));
  if (error) return <><AppBar title="Course" onBack={back} /><div className="content"><ErrorNote>{error}</ErrorNote></div></>;
  if (!c) return <><AppBar title="Course" onBack={back} /><Loading /></>;
  const weekly = c.hours ? c.hours.total / 26 : null;
  const main = c.skills.filter((s) => s.primary);
  const more = c.skills.filter((s) => !s.primary);
  return (
    <>
      <AppBar title={c.series} sub="Course" onBack={back} />
      <main className="content enter">
        <div className="stack">
          <span className="eyebrow">{c.series} · {c.course_id}</span>
          <h1>{c.title}</h1>
          <p className="small muted">{c.nsqf_label}</p>
        </div>
        <div className="card soft row" style={{ alignItems: 'flex-start' }}>
          <span className="tile"><Target size={20} strokeWidth={1.75} /></span>
          <div><p className="label">After this course</p><p>You are likely to be able to {c.terminal_outcome}.</p></div>
        </div>
        <div className="row wrap">
          {c.hours ? <span className="pill navy"><Clock size={14} /> About {c.hours.total} hours</span> : null}
          {weekly ? <span className="pill plain">About {weekly < 1 ? 'less than 1 hour' : `${Math.round(weekly * 2) / 2} hours`} a week for 6 months</span> : null}
          {c.pitched_at ? <span className="pill plain">For: {c.pitched_at.toLowerCase()}</span> : null}
        </div>
        <section className="card stack">
          <div className="row"><span className="tile navy"><BookOpen size={20} strokeWidth={1.75} /></span><h3>What you will study</h3></div>
          <ol className="list" style={{ paddingLeft: 0 }}>
            {c.modules.map((m, i) => <li key={m} className="row"><span className="term-dot planned" style={{ position: 'static' }}>{i + 1}</span><span>{m}</span></li>)}
          </ol>
          {c.assessment_gate ? <p className="small muted"><ListChecks size={14} style={{ verticalAlign: '-2px' }} /> To pass: {c.assessment_gate}.</p> : null}
        </section>
        <section className="card stack">
          <h3>Skills it builds</h3>
          <ul className="list">
            {[...main, ...more].map((s) => (
              <li key={s.skill_id} className="stack" style={{ gap: 6 }}>
                <div className="row"><strong className="spacer">{s.name}</strong><span className="pill navy mono">to {fmtLevel(s.level_out)}</span></div>
                <p className="small muted">{s.definition}</p>
                <LevelMeter have={0} gain={s.level_out} label={`Builds to level ${fmtLevel(s.level_out)} of 8`} />
              </li>
            ))}
          </ul>
        </section>
        <section className="card stack">
          <h3>Before you start</h3>
          {c.prerequisites.hard.length ? (
            <p className="small">Finish <strong>{c.prerequisites.hard.map((p) => p.title).join(', ')}</strong> first, or show level {fmtLevel(c.prerequisites.entry_level)} in the skill check.</p>
          ) : <p className="small"><CheckCircle2 size={14} style={{ verticalAlign: '-2px', color: 'var(--success)' }} /> No earlier course needed.</p>}
          {c.prerequisites.soft.length ? <p className="small muted">It helps to finish {c.prerequisites.soft.map((p) => p.title).join(', ')} first.</p> : null}
        </section>
        {c.unlocks.length ? (
          <section className="card stack">
            <h3>What it opens next</h3>
            {c.unlocks.map((u) => <p key={u.course_id} className="row"><KeyRound size={16} /> {u.title}</p>)}
          </section>
        ) : null}
      </main>
    </>
  );
}
