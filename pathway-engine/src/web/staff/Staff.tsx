/**
 * Staff area: sign-in with an access code (mentor or content admin) and the console frame.
 */
import { useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, ApiError, staffSession } from '../api';
import { Brand, ErrorNote } from '../components/ui';
import Mentor from './Mentor';
import Admin from './Admin';

export function ConsoleFrame({ chip, children }: { chip: string; children: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="console">
      <header className="console-top">
        <div className="console-top-inner">
          <Brand />
          <span className="pill gold">{chip}</span>
          <span className="spacer" />
          <button className="btn btn-ghost btn-sm" onClick={() => { staffSession.clear(); nav('/staff'); }}>Sign out</button>
        </div>
      </header>
      <main className="console-main">{children}</main>
    </div>
  );
}

function Login() {
  const nav = useNavigate();
  const [role, setRole] = useState<'mentor' | 'admin'>('mentor');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const out = await api.post<{ token: string; role: 'mentor' | 'admin' }>('/staff/session', { role, code });
      staffSession.set(out);
      nav(out.role === 'admin' ? '/staff/admin' : '/staff/mentor');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in.');
    }
  };
  return (
    <div className="console" style={{ display: 'grid', placeItems: 'center', padding: 16 }}>
      <form className="card raised stack-lg" style={{ width: '100%', maxWidth: 420 }} onSubmit={submit}>
        <Brand />
        <div className="stack" style={{ gap: 4 }}><p className="eyebrow">Pathway Engine</p><h2>Staff sign in</h2><p className="small muted">For institution mentors and the content team.</p></div>
        <div className="segmented" role="radiogroup" aria-label="Role">
          <button type="button" role="radio" aria-checked={role === 'mentor'} onClick={() => setRole('mentor')}>Mentor</button>
          <button type="button" role="radio" aria-checked={role === 'admin'} onClick={() => setRole('admin')}>Content admin</button>
        </div>
        <div className="field"><label htmlFor="code">Access code</label><input id="code" className="input" type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} /></div>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <button className="btn btn-primary btn-block" disabled={!code}>Sign in</button>
        <a href="/" className="small" style={{ textAlign: 'center' }}>Back to the learner app</a>
      </form>
    </div>
  );
}

function RequireStaff({ role, children }: { role: 'mentor' | 'admin'; children: ReactNode }) {
  const s = staffSession.get();
  if (!s || (role === 'admin' && s.role !== 'admin')) return <Navigate to="/staff" replace />;
  return <>{children}</>;
}

export default function Staff() {
  return (
    <Routes>
      <Route index element={<Login />} />
      <Route path="mentor/*" element={<RequireStaff role="mentor"><Mentor /></RequireStaff>} />
      <Route path="admin/*" element={<RequireStaff role="admin"><Admin /></RequireStaff>} />
      <Route path="*" element={<Navigate to="/staff" replace />} />
    </Routes>
  );
}
