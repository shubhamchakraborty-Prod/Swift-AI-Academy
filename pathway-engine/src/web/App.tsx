/**
 * Routes. Learner screens sit inside a phone-width shell; staff consoles (/staff) use the full width.
 * <Guard> sends a learner to the step they are actually on, so refresh, back and resume never lose their place,
 * and finished adaptive parts (the skill check) cannot be reopened.
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LearnerProvider, ToastProvider, useLearner } from './state';
import { LangProvider } from './i18n';
import { pathForStep } from './journey';
import type { Progress, Step } from './types';
import { Loading } from './components/ui';
import Welcome from './screens/Welcome';
import Consent from './screens/Consent';
import About from './screens/About';
import Profile from './screens/Profile';
import SkillCheck from './screens/SkillCheck';
import Goals from './screens/Goals';
import Quick from './screens/Quick';
import Building from './screens/Building';
import Guardian from './screens/Guardian';
import Results from './screens/Results';
import Course from './screens/Course';
import Dashboard from './screens/Dashboard';

const Staff = lazy(() => import('./staff/Staff'));

const RANK: Record<Step, number> = { about: 0, profile: 1, skill_ai: 2, skill_comm: 3, goals: 4, tiebreak: 5, plan: 6, results: 7, dashboard: 8 };

/** Sends the learner to where they actually are, so refresh, back and resume never lose their place. */
function Guard({ rank, children, allow }: { rank: number; children: ReactNode; allow?: (p: Progress, search: URLSearchParams) => boolean }) {
  const { progress, loading, hasSession } = useLearner();
  const loc = useLocation();
  if (!hasSession) return <Navigate to="/" replace />;
  if (loading || !progress) return <Loading />;
  const current = RANK[progress.step];
  if (allow?.(progress, new URLSearchParams(loc.search))) return <>{children}</>;
  if (rank !== current && !(rank >= 7 && current >= 7)) return <Navigate to={pathForStep(progress.step)} replace />;
  return <>{children}</>;
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="shell"><div className="shell-col">{children}</div></div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <LangProvider>
      <ToastProvider>
        <Routes>
          <Route path="/staff/*" element={<Suspense fallback={<Loading />}><Staff /></Suspense>} />
          <Route path="*" element={
            <LearnerProvider>
              <Shell>
                <Routes>
                  <Route path="/" element={<Welcome />} />
                  <Route path="/start" element={<Consent />} />
                  <Route path="/journey/about" element={<Guard rank={0}><About /></Guard>} />
                  <Route path="/journey/profile" element={<Guard rank={1} allow={(p) => p.part_b.open}><Profile /></Guard>} />
                  <Route path="/journey/skills" element={<Guard rank={2}><SkillCheck series="ai" /></Guard>} />
                  <Route path="/journey/skills/communication" element={<Guard rank={3}><SkillCheck series="comm" /></Guard>} />
                  <Route path="/journey/goals" element={<Guard rank={4} allow={(p, s) => s.get('edit') === '1' && RANK[p.step] >= 7}><Goals /></Guard>} />
                  <Route path="/journey/quick" element={<Guard rank={5} allow={(_p, s) => s.get('replan') === '1'}><Quick /></Guard>} />
                  <Route path="/journey/building" element={<Guard rank={6} allow={(p, s) => s.get('replan') === '1' || p.guardian_status === 'given'}><Building /></Guard>} />
                  <Route path="/guardian" element={<Guard rank={6} allow={(p) => p.guardian_status === 'pending'}><Guardian /></Guard>} />
                  <Route path="/results" element={<Navigate to="/results/type" replace />} />
                  <Route path="/results/:step" element={<Guard rank={7}><Results /></Guard>} />
                  <Route path="/app" element={<Guard rank={8}><Dashboard /></Guard>} />
                  <Route path="/app/:tab" element={<Guard rank={8}><Dashboard /></Guard>} />
                  <Route path="/course/:id" element={<Course />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Shell>
            </LearnerProvider>
          } />
        </Routes>
      </ToastProvider>
      </LangProvider>
    </BrowserRouter>
  );
}
