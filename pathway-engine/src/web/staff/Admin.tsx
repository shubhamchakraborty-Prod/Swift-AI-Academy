import { useEffect, useState } from 'react';
import { CheckCircle2, Plus, Trash2, XCircle } from 'lucide-react';
import { api, ApiError } from '../api';
import { ErrorNote, Loading } from '../components/ui';
import { useToast } from '../state';
import { ConsoleFrame } from './Staff';

type Tab = 'courses' | 'config' | 'catalogue';

const blankCourse = () => ({
  course_id: '', title: '', series_id: '', provider: 'In-house', nsqf_level: { min: 1, max: 1 }, level_out: 1,
  hours: { training: 0, assessment: 0, total: 0 }, entry_level: 0, entry_ladder: 'ai', prerequisites: { hard: [] as string[], soft: [] as string[] },
  eligibility: [], delivery: { modes: ['facilitated_lab'], offline_ok: false, device_min: 'own_phone', languages: ['en'] },
  terminal_outcome: '', modules: [{ title: '', outcomes: [{ lo_id: 'LO-1', text: '', type: 'practical', skill_ids: [] as string[] }] }],
  assessment_gate: '', skills: [{ skill_id: '', level_out: 1, primary: true, evidence: '' }],
});

function Num({ label, value, onChange, step = 0.5 }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return <div className="field"><label>{label}</label><input className="input" type="number" step={step} min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} /></div>;
}

/** AD01 + AD02: the onboarding template as a form, then validate, simulate and activate. */
function CourseEditor({ initial, skills, courses, onDone }: { initial: any; skills: { skill_id: string; name: string }[]; courses: string[]; onDone: () => void }) {
  const toast = useToast();
  const [c, setC] = useState<any>(initial);
  const [saved, setSaved] = useState(false);
  const [validation, setValidation] = useState<any>(null);
  const [sim, setSim] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: any) => { setC({ ...c, ...patch }); setSaved(false); setValidation(null); setSim(null); };
  const save = async () => {
    setError(null);
    try { await api.post('/admin/courses', c, { staff: true }); setSaved(true); toast('Draft saved'); }
    catch (e) { setError(e instanceof ApiError ? `${e.message}${e.details?.fieldErrors ? ': ' + Object.keys(e.details.fieldErrors).join(', ') : ''}` : 'Could not save'); }
  };
  const validate = async () => setValidation(await api.post(`/admin/courses/${c.course_id}/validate`, {}, { staff: true }));
  const simulate = async () => setSim(await api.post(`/admin/courses/${c.course_id}/simulate`, {}, { staff: true }));
  const activate = async () => {
    try { const r = await api.post(`/admin/courses/${c.course_id}/activate`, {}, { staff: true }); toast(`Activated. Data version ${r.version}`); onDone(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not activate'); }
  };
  const mod = (i: number, patch: any) => set({ modules: c.modules.map((m: any, n: number) => (n === i ? { ...m, ...patch } : m)) });
  return (
    <section className="card stack-lg">
      <div className="row"><h2 className="spacer">{initial.course_id ? `Edit ${initial.course_id}` : 'New course'}</h2><button className="btn btn-ghost btn-sm" onClick={onDone}>Close</button></div>
      <div className="stack"><p className="eyebrow">A. Identity</p>
        <div className="form-grid">
          <div className="field"><label>Course ID</label><input className="input" value={c.course_id} placeholder="AAI-5" onChange={(e) => set({ course_id: e.target.value.toUpperCase() })} disabled={Boolean(initial.course_id)} /></div>
          <div className="field"><label>Series ID</label><input className="input" value={c.series_id} placeholder="AAI" onChange={(e) => set({ series_id: e.target.value.toUpperCase() })} /></div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Learner-facing title</label><input className="input" value={c.title} onChange={(e) => set({ title: e.target.value })} /></div>
        </div></div>
      <div className="stack"><p className="eyebrow">B. Level and hours</p>
        <div className="form-grid">
          <Num label="NSQF level from" value={c.nsqf_level.min} onChange={(n) => set({ nsqf_level: { ...c.nsqf_level, min: n } })} />
          <Num label="NSQF level to" value={c.nsqf_level.max} onChange={(n) => set({ nsqf_level: { ...c.nsqf_level, max: n } })} />
          <Num label="Output level for skills" value={c.level_out} onChange={(n) => set({ level_out: n })} />
          <Num label="Total hours" step={1} value={c.hours?.total ?? 0} onChange={(n) => set({ hours: { ...(c.hours ?? { training: 0, assessment: 0 }), total: n } })} />
          <Num label="Training hours" step={1} value={c.hours?.training ?? 0} onChange={(n) => set({ hours: { ...(c.hours ?? { total: 0, assessment: 0 }), training: n } })} />
          <Num label="Assessment hours" step={1} value={c.hours?.assessment ?? 0} onChange={(n) => set({ hours: { ...(c.hours ?? { total: 0, training: 0 }), assessment: n } })} />
        </div></div>
      <div className="stack"><p className="eyebrow">C. Entry</p>
        <div className="form-grid">
          <Num label="Entry level" value={c.entry_level} onChange={(n) => set({ entry_level: n })} />
          <div className="field"><label>Placement ladder used for entry</label><select className="select" value={c.entry_ladder} onChange={(e) => set({ entry_ladder: e.target.value })}><option value="ai">AI skill check</option><option value="comm">Communication skill check</option></select></div>
          <div className="field"><label>Hard prerequisites</label><select className="select" multiple style={{ minHeight: 96 }} value={c.prerequisites.hard} onChange={(e) => set({ prerequisites: { ...c.prerequisites, hard: [...e.target.selectedOptions].map((o) => o.value) } })}>{courses.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div className="field"><label>Soft prerequisites</label><select className="select" multiple style={{ minHeight: 96 }} value={c.prerequisites.soft} onChange={(e) => set({ prerequisites: { ...c.prerequisites, soft: [...e.target.selectedOptions].map((o) => o.value) } })}>{courses.map((x) => <option key={x}>{x}</option>)}</select></div>
        </div></div>
      <div className="stack"><p className="eyebrow">D. Delivery</p>
        <label className="check" style={{ padding: 12 }}><input type="checkbox" checked={Boolean(c.delivery.offline_ok)} onChange={(e) => set({ delivery: { ...c.delivery, offline_ok: e.target.checked } })} /><span>Works offline</span></label></div>
      <div className="stack"><p className="eyebrow">E. Skills built (at least 3, one primary)</p>
        {c.skills.map((s: any, i: number) => (
          <div key={i} className="row wrap" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '2 1 240px' }}><label>Skill</label><select className="select" value={s.skill_id} onChange={(e) => set({ skills: c.skills.map((x: any, n: number) => (n === i ? { ...x, skill_id: e.target.value } : x)) })}><option value="">Choose a skill</option>{skills.map((k) => <option key={k.skill_id} value={k.skill_id}>{k.skill_id} {k.name}</option>)}</select></div>
            <div style={{ flex: '0 1 120px' }}><Num label="Output level" value={s.level_out} onChange={(n) => set({ skills: c.skills.map((x: any, j: number) => (j === i ? { ...x, level_out: n } : x)) })} /></div>
            <label className="row small" style={{ minHeight: 52 }}><input type="checkbox" checked={s.primary} onChange={(e) => set({ skills: c.skills.map((x: any, j: number) => (j === i ? { ...x, primary: e.target.checked } : x)) })} /> Primary</label>
            <button className="icon-btn" aria-label="Remove skill" onClick={() => set({ skills: c.skills.filter((_: any, j: number) => j !== i) })}><Trash2 size={18} /></button>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set({ skills: [...c.skills, { skill_id: '', level_out: c.level_out, primary: false, evidence: '' }] })}><Plus size={16} /> Add skill</button></div>
      <div className="stack"><p className="eyebrow">F. Modules and learning outcomes</p>
        {c.modules.map((m: any, i: number) => (
          <div key={i} className="card soft stack">
            <div className="field"><label>Module {i + 1} title</label><input className="input" value={m.title} onChange={(e) => mod(i, { title: e.target.value })} /></div>
            {(m.outcomes ?? []).map((lo: any, j: number) => (
              <div key={j} className="form-grid">
                <div className="field"><label>Learning outcome {lo.lo_id}</label><input className="input" value={lo.text} onChange={(e) => mod(i, { outcomes: m.outcomes.map((x: any, k: number) => (k === j ? { ...x, text: e.target.value } : x)) })} /></div>
                <div className="field"><label>Skills (up to 3)</label><select className="select" multiple style={{ minHeight: 96 }} value={lo.skill_ids} onChange={(e) => mod(i, { outcomes: m.outcomes.map((x: any, k: number) => (k === j ? { ...x, skill_ids: [...e.target.selectedOptions].map((o) => o.value) } : x)) })}>{c.skills.filter((s: any) => s.skill_id).map((s: any) => <option key={s.skill_id}>{s.skill_id}</option>)}</select></div>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => mod(i, { outcomes: [...(m.outcomes ?? []), { lo_id: `LO-${i + 1}.${(m.outcomes?.length ?? 0) + 1}`, text: '', type: 'practical', skill_ids: [] }] })}><Plus size={16} /> Add outcome</button>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set({ modules: [...c.modules, { title: '', outcomes: [] }] })}><Plus size={16} /> Add module</button></div>
      <div className="stack"><p className="eyebrow">G. Outcome for learners</p>
        <div className="field"><label>Terminal outcome (starts with a verb, completes "you are likely to be able to ...")</label><input className="input" value={c.terminal_outcome} onChange={(e) => set({ terminal_outcome: e.target.value })} /></div>
        <div className="field"><label>Assessment summary</label><input className="input" value={c.assessment_gate ?? ''} onChange={(e) => set({ assessment_gate: e.target.value })} /></div></div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="row wrap">
        <button className="btn btn-secondary" onClick={save}>1. Save draft</button>
        <button className="btn btn-secondary" disabled={!saved} onClick={validate}>2. Validate</button>
        <button className="btn btn-secondary" disabled={!validation?.ok} onClick={simulate}>3. Simulate</button>
        <button className="btn btn-primary" disabled={!validation?.ok || !sim} onClick={activate}>4. Activate</button>
      </div>
      {validation ? (
        <div className="stack">
          <h3>Validation</h3>
          <ul className="list">{validation.checks.map((ch: any) => (
            <li key={ch.id} className="row" style={{ alignItems: 'flex-start' }}>
              {ch.ok ? <CheckCircle2 size={18} color="var(--success)" /> : <XCircle size={18} color="var(--danger)" />}
              <div><strong>{ch.id}. {ch.name}</strong>{ch.messages.map((m: string) => <p key={m} className="small" style={{ color: 'var(--danger-700)' }}>{m}</p>)}</div>
            </li>))}</ul>
        </div>
      ) : null}
      {sim ? (
        <div className="stack">
          <h3>Simulation on 20 reference learners</h3>
          <p className="small muted">{sim.filter((s) => s.changed).length} plans would change. Existing learner plans are never changed by activation.</p>
          <div className="table-wrap"><table className="data">
            <thead><tr><th>Learner</th><th>Before</th><th>After</th></tr></thead>
            <tbody>{sim.filter((s) => s.changed).map((s) => <tr key={s.id}><td>{s.id} <span className="small muted">{s.label}</span></td><td className="mono small">{s.before.terms.join(' → ') || 'none'}</td><td className="mono small">{s.after.terms.join(' → ') || 'none'}</td></tr>)}</tbody>
          </table></div>
        </div>
      ) : null}
    </section>
  );
}

function Courses() {
  const [data, setData] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const load = () => api.get('/admin/courses', { staff: true }).then(setData);
  useEffect(() => { load(); }, []);
  if (!data) return <Loading />;
  if (editing) return <CourseEditor initial={editing} skills={data.skills} courses={data.courses.map((c: any) => c.course_id)} onDone={() => { setEditing(null); load(); }} />;
  return (
    <section className="stack">
      <div className="row"><p className="muted spacer">Data version <span className="mono">{data.reference_version}</span>. New courses enter by template, with no code change.</p><button className="btn btn-primary btn-sm" onClick={() => setEditing(blankCourse())}><Plus size={16} /> New course</button></div>
      <div className="table-wrap"><table className="data">
        <thead><tr><th>Course</th><th>Series</th><th className="num">Level</th><th className="num">Hours</th><th className="num">Skills</th><th>Status</th><th /></tr></thead>
        <tbody>
          {[...data.courses, ...data.new_drafts.map((d: any) => ({ ...d.data, status: 'draft (new)' }))].map((c: any) => (
            <tr key={c.course_id}>
              <td><strong className="mono">{c.course_id}</strong><br />{c.title}{c.status_note ? <><br /><span className="small muted">{c.status_note}</span></> : null}</td>
              <td>{c.series_id}</td><td className="num">{c.level_out}</td><td className="num">{c.hours?.total ?? 'to confirm'}</td><td className="num">{c.skills.length}</td>
              <td><span className={`pill ${c.status === 'active' ? 'success' : 'warning'}`}>{c.status}</span></td>
              <td><button className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...blankCourse(), ...(c.draft?.data ?? c), hours: c.hours ?? { training: 0, assessment: 0, total: 0 }, modules: c.modules.map((m: any) => ({ outcomes: [], ...m })) })}>Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </section>
  );
}

/** AD05: config versions with simulate, activate and roll back. */
function Config() {
  const toast = useToast();
  const [v, setV] = useState<any>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [sim, setSim] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => api.get('/admin/versions', { staff: true }).then((r) => { setV(r); setText(JSON.stringify(r.active_config, null, 2)); });
  useEffect(() => { load(); }, []);
  if (!v) return <Loading />;
  const parse = () => { try { setError(null); return JSON.parse(text); } catch { setError('The config is not valid JSON'); return null; } };
  const simulate = async () => { const cfg = parse(); if (cfg) { try { setSim(await api.post('/admin/config/simulate', { note: note || 'simulation', config: cfg }, { staff: true })); } catch (e) { setError((e as Error).message); } } };
  const create = async () => { const cfg = parse(); if (!cfg) return; try { const r = await api.post('/admin/config', { note, config: cfg }, { staff: true }); toast(`Saved as ${r.version}. Activate it when ready.`); setSim(null); setNote(''); load(); } catch (e) { setError((e as Error).message); } };
  const activate = async (table: 'config' | 'reference', version: string) => { await api.post(`/admin/${table}/${version}/activate`, {}, { staff: true }); toast(`${version} is now active`); load(); };
  const Versions = ({ rows, table }: { rows: any[]; table: 'config' | 'reference' }) => (
    <div className="table-wrap"><table className="data">
      <thead><tr><th>Version</th><th>Note</th><th>Created</th><th /></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.version}><td className="mono">{r.version}</td><td>{r.note}</td><td className="small">{new Date(r.created_at).toLocaleString('en-IN')}</td>
        <td>{r.active ? <span className="pill success">Active</span> : <button className="btn btn-ghost btn-sm" onClick={() => activate(table, r.version)}>Activate</button>}</td></tr>)}</tbody>
    </table></div>
  );
  return (
    <div className="grid-2">
      <section className="card stack">
        <h3>Create a config version</h3>
        <p className="small muted">Change one value at a time. Every candidate runs on the 20 reference learners before it is saved. Saved versions start inactive.</p>
        <textarea className="textarea mono" style={{ minHeight: 360, fontSize: 12 }} aria-label="Engine config JSON" value={text} onChange={(e) => { setText(e.target.value); setSim(null); }} />
        <div className="field"><label htmlFor="note">Reason for the change</label><input id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <div className="row wrap"><button className="btn btn-secondary" onClick={simulate}>Simulate</button><button className="btn btn-primary" disabled={!sim || note.trim().length < 3} onClick={create}>Save as new version</button></div>
        {sim ? <p className="small">{sim.filter((s) => s.changed).length} of {sim.length} reference learners would get a different result: {sim.filter((s) => s.changed).map((s) => s.id).join(', ') || 'none'}.</p> : null}
      </section>
      <div className="stack-lg">
        <section className="card stack"><h3>Config versions</h3><Versions rows={v.config_versions} table="config" /></section>
        <section className="card stack"><h3>Reference data versions</h3><p className="small muted">Activating an older version rolls the catalogue back in one step.</p><Versions rows={v.reference_versions} table="reference" /></section>
      </div>
    </div>
  );
}

/** AD03 + AD04 (read-only in this build): skills, goal-area needs and the item bank. */
function Catalogue() {
  const [d, setD] = useState<any>(null);
  const [view, setView] = useState<'skills' | 'goals' | 'items'>('skills');
  useEffect(() => { api.get('/admin/reference', { staff: true }).then(setD); }, []);
  if (!d) return <Loading />;
  return (
    <section className="stack">
      <div className="segmented" style={{ maxWidth: 420 }} role="radiogroup" aria-label="Catalogue view">
        {(['skills', 'goals', 'items'] as const).map((x) => <button key={x} role="radio" aria-checked={view === x} onClick={() => setView(x)}>{x === 'skills' ? `Skills (${d.skills.skills.length})` : x === 'goals' ? 'Goal areas' : 'Item bank'}</button>)}
      </div>
      {view === 'skills' && <div className="table-wrap"><table className="data"><thead><tr><th>ID</th><th>Skill</th><th>Cluster</th><th>Status</th></tr></thead><tbody>{d.skills.skills.map((s: any) => <tr key={s.skill_id}><td className="mono">{s.skill_id}</td><td>{s.name}<br /><span className="small muted">{s.definition}</span></td><td className="mono">{s.cluster_id}</td><td>{s.status}</td></tr>)}</tbody></table></div>}
      {view === 'goals' && <div className="table-wrap"><table className="data"><thead><tr><th>Goal area</th><th>Skill needs</th></tr></thead><tbody>{d.goal_areas.map((g: any) => <tr key={g.goal_id}><td><strong className="mono">{g.goal_id}</strong> {g.name}<br /><span className="small muted">Outlook {g.market_outlook} · {g.primary_orientation}, {g.secondary_orientation}</span></td><td className="small">{d.goal_skills.filter((x: any) => x.goal_id === g.goal_id).map((x: any) => `${x.skill_id} (${x.importance}, ${x.required_level})`).join('; ')}</td></tr>)}</tbody></table></div>}
      {view === 'items' && <div className="table-wrap"><table className="data"><thead><tr><th>ID</th><th>Text</th><th>Status</th></tr></thead><tbody>{[...d.items.part_a, ...d.items.part_b, ...d.items.part_c, ...d.items.part_d].map((i: any) => <tr key={i.item_id}><td className="mono">{i.item_id}</td><td>{i.text_en}</td><td className="small">{i.status}{i.review_status === 'draft_pending_content_review' ? <><br /><span className="pill warning">Draft, needs content review</span></> : null}</td></tr>)}</tbody></table></div>}
    </section>
  );
}

export default function Admin() {
  const [tab, setTab] = useState<Tab>('courses');
  return (
    <ConsoleFrame chip="Internal · content team">
      <div className="stack" style={{ gap: 4 }}><h1>Pathway Engine admin</h1><p className="muted">Courses, config versions and the reference catalogue. Every change is versioned and can be rolled back.</p></div>
      <div className="tabs" role="tablist">
        {(['courses', 'config', 'catalogue'] as Tab[]).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t === 'courses' ? 'Courses' : t === 'config' ? 'Config versions' : 'Catalogue'}</button>)}
      </div>
      {tab === 'courses' ? <Courses /> : tab === 'config' ? <Config /> : <Catalogue />}
    </ConsoleFrame>
  );
}
