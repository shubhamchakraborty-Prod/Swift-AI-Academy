import { useEffect, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { api, ApiError } from '../api';
import { ErrorNote, Loading } from '../components/ui';
import { fmtLevel } from '../journey';
import { ConsoleFrame } from './Staff';

const n2 = (x: number | null | undefined) => (x === null || x === undefined || Number.isNaN(x) ? 'n/a' : x.toFixed(2));
const STEP: Record<string, string> = { about: 'About you', profile: 'Learning profile', skill_ai: 'Skill check', skill_comm: 'Skill check', goals: 'Goals', tiebreak: 'Quick question', plan: 'Plan pending', results: 'Reviewing plan', dashboard: 'Plan accepted' };

function List() {
  const nav = useNavigate();
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.get('/mentor/learners', { staff: true }).then(setRows).catch((e: ApiError) => setError(e.message)); }, []);
  return (
    <>
      <div className="stack" style={{ gap: 4 }}><h1>Learners</h1><p className="muted">Learners who agreed to share their results with mentors.</p></div>
      {error ? <ErrorNote>{error}</ErrorNote> : !rows ? <Loading /> : rows.length === 0 ? <div className="card"><p className="muted">No learners have shared results yet.</p></div> : (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Learner</th><th>Age</th><th>Stage</th><th>Persona</th><th>Plan</th><th>Started</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.learner_id} className="clickable" tabIndex={0} onClick={() => nav(r.learner_id)} onKeyDown={(e) => e.key === 'Enter' && nav(r.learner_id)}>
                  <td><strong>{r.name}</strong><br /><span className="mono small muted">{r.learner_id}</span></td>
                  <td className="num">{r.age}</td>
                  <td>{STEP[r.step] ?? r.step}{r.guardian_status === 'pending' ? <><br /><span className="pill warning">Guardian consent pending</span></> : null}</td>
                  <td className="mono">{r.persona_code ?? 'n/a'}</td>
                  <td>{r.pathway_status ?? 'n/a'}</td>
                  <td className="small">{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Detail() {
  const { id } = useParams();
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [replay, setReplay] = useState<string | null>(null);
  useEffect(() => { api.get(`/mentor/learners/${id}`, { staff: true }).then(setD).catch((e: ApiError) => setError(e.message)); }, [id]);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!d) return <Loading />;
  const out = d.run?.output;
  const addNote = async () => { setD(await api.post(`/mentor/learners/${id}/notes`, { text: note }, { staff: true })); setNote(''); };
  const doReplay = async () => { const r = await api.post(`/runs/${d.run.run_id}/replay`, {}, { staff: true }); setReplay(r.identical ? 'Replay matches the stored run exactly.' : 'Replay differs from the stored run.'); };
  return (
    <>
      <Link to=".." relative="path" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}><ChevronLeft size={16} /> All learners</Link>
      <div className="row wrap">
        <div className="spacer"><h1>{d.name}</h1><p className="mono small muted">{d.learner_id} · Age {d.age} · {STEP[d.progress.step]}</p></div>
        {out ? <span className="pill navy mono">{out.persona.persona_code} · {out.persona.name}</span> : null}
      </div>
      {!out ? <div className="card"><p className="muted">No plan has been computed yet.</p></div> : (
        <div className="grid-2">
          <div className="stack-lg">
            <section className="card stack">
              <h3>Persona and axes</h3>
              <dl className="kv">
                <dt>Persona</dt><dd>{out.persona.persona_code} {out.persona.name}</dd>
                <dt>Second choice</dt><dd>{out.persona.secondary_code} {out.persona.secondary_name}</dd>
                <dt>Confidence</dt><dd>{n2(out.persona.confidence)} ({out.persona.confidence_label})</dd>
                <dt>Learning profile used</dt><dd>{out.part_b_used ? 'Yes' : 'No, quality flags'}</dd>
              </dl>
              <div className="table-wrap"><table className="data">
                <thead><tr><th>Axis</th><th>Parameter</th><th className="num">Weight</th><th className="num">Value</th></tr></thead>
                <tbody>{out.persona.axes.flatMap((a: any) => [
                  <tr key={a.axis}><td colSpan={2}><strong>{a.name}</strong> <span className="pill plain">{a.pole_name}{a.pole_reason === 'supportive_default' ? ' (supportive default)' : ''}</span></td><td className="num">score</td><td className="num"><strong>{n2(a.score)}</strong></td></tr>,
                  ...a.parameters.map((p: any) => <tr key={a.axis + p.id}><td /><td>{p.label}</td><td className="num">{p.weight.toFixed(2)}</td><td className="num">{p.value === null ? 'left out' : n2(p.value)}</td></tr>),
                  ...(a.tiebreak_value !== null ? [<tr key={a.axis + 'tb'}><td /><td>Tie-breaker answer</td><td className="num">0.25</td><td className="num">{n2(a.tiebreak_value)}</td></tr>] : []),
                ])}</tbody>
              </table></div>
            </section>
            <section className="card stack">
              <h3>Goal areas (all 12)</h3>
              <div className="table-wrap"><table className="data">
                <thead><tr><th>#</th><th>Goal area</th><th className="num">Choice</th><th className="num">Fit</th><th className="num">Field</th><th className="num">Market</th><th className="num">Score</th></tr></thead>
                <tbody>{out.goals.ranked.map((g: any) => <tr key={g.goal_id}><td className="num">{g.rank}</td><td className="mono">{g.goal_id}</td><td className="num">{n2(g.asp)}</td><td className="num">{n2(g.fit)}</td><td className="num">{n2(g.field)}</td><td className="num">{n2(g.market)}</td><td className="num"><strong>{n2(g.score)}</strong></td></tr>)}</tbody>
              </table></div>
            </section>
            {out.course_scores_by_term.map((t: any) => (
              <section key={t.term_no} className="card stack">
                <h3>Course scores, term {t.term_no}</h3>
                <div className="table-wrap"><table className="data">
                  <thead><tr><th>Course</th><th>Eligible</th><th className="num">A</th><th className="num">U</th><th className="num">B</th><th className="num">F</th><th className="num">Soft</th><th className="num">Score</th></tr></thead>
                  <tbody>{t.scores.map((c: any) => (
                    <tr key={c.course_id}><td className="mono">{c.course_id}{c.recommended ? ' ✓' : ''}</td><td className="small">{c.eligible ? 'Yes' : c.ineligible.map((x: any) => x.detail).join('; ')}</td>
                      {c.eligible ? <><td className="num">{n2(c.A)}</td><td className="num">{n2(c.U)}</td><td className="num">{n2(c.B)}</td><td className="num">{n2(c.F)}</td><td className="num">{n2(c.p_soft)}</td><td className="num"><strong>{n2(c.score)}</strong>{c.below_placement ? <><br /><span className="small muted">at or below level</span></> : null}</td></> : <td colSpan={6} className="small muted">Not scored</td>}</tr>
                  ))}</tbody>
                </table></div>
              </section>
            ))}
            <section className="card stack">
              <h3>Skill needs</h3>
              <div className="table-wrap"><table className="data">
                <thead><tr><th>Skill</th><th className="num">Demand</th><th className="num">Needed</th><th className="num">Now</th><th className="num">Gap</th></tr></thead>
                <tbody>{out.needs.map((s: any) => <tr key={s.skill_id}><td className="mono">{s.skill_id}</td><td className="num">{n2(s.demand)}</td><td className="num">{fmtLevel(s.required)}</td><td className="num">{fmtLevel(s.current)}</td><td className="num">{fmtLevel(s.gap)}</td></tr>)}</tbody>
              </table></div>
            </section>
          </div>
          <div className="stack-lg">
            <section className="card stack">
              <h3>Plan</h3>
              {out.pathway.terms.map((t: any) => <p key={t.term_no}><span className="eyebrow muted">Months {t.months}</span><br /><strong>{t.course_id} {t.title}</strong> <span className="mono small">{n2(t.score)}</span></p>)}
              <p className="small muted">Status: {d.pathway?.status}. Config {d.run.config_version}, data {d.run.reference_version}. Trigger: {d.run.trigger}.</p>
              <button className="btn btn-secondary btn-sm" onClick={doReplay}>Replay this run</button>
              {replay ? <p className="small" role="status">{replay}</p> : null}
            </section>
            <section className="card stack">
              <h3>Learning profile scales</h3>
              {d.part_b ? (<>
                <div className="table-wrap"><table className="data"><tbody>{Object.entries(d.part_b.scales).map(([k, v]) => <tr key={k}><td>{k.replace(/_/g, ' ')}</td><td className="num">{n2(v as number)}</td></tr>)}</tbody></table></div>
                {d.part_b.flags.length ? <p className="pill warning">Flags: {d.part_b.flags.join(', ')}</p> : <p className="small muted">All quality checks passed.</p>}
              </>) : <p className="muted small">Not submitted.</p>}
              <dl className="kv"><dt>AI placement</dt><dd>{d.placements.ai ?? 'n/a'}</dd><dt>Communication placement</dt><dd>{d.placements.comm ?? 'n/a'}</dd></dl>
              {d.confidence_check ? <p className="small muted">Confidence check: English {n2(d.confidence_check.english.confidence)} vs level {d.confidence_check.english.placement}; Technology and AI {n2(d.confidence_check.tech_ai.confidence)} vs level {d.confidence_check.tech_ai.placement}. {d.confidence_check.bands_status}</p> : null}
            </section>
            <section className="card stack">
              <h3>Learner note</h3>
              <p className="small">{d.learner_note ?? <span className="muted">No note.</span>}</p>
              <p className="small muted">Persona recognised: {d.persona_feedback ?? 'not answered'}</p>
            </section>
            <section className="card stack">
              <h3>Mentor notes</h3>
              {d.notes.map((n: any) => <p key={n.note_id} className="small"><span className="muted">{new Date(n.at).toLocaleString('en-IN')}:</span> {n.text}</p>)}
              <textarea className="textarea" aria-label="New note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for this learner" />
              <button className="btn btn-primary btn-sm" disabled={!note.trim()} onClick={addNote}>Add note</button>
            </section>
          </div>
        </div>
      )}
    </>
  );
}

export default function Mentor() {
  return (
    <ConsoleFrame chip="Internal · mentors">
      <Routes>
        <Route index element={<List />} />
        <Route path=":id" element={<Detail />} />
      </Routes>
    </ConsoleFrame>
  );
}
