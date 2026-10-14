/**
 * App-wide React state: the learner's progress (refreshed from the server after every step) and toasts.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, session } from './api';
import type { Progress } from './types';

interface LearnerState {
  progress: Progress | null;
  loading: boolean;
  hasSession: boolean;
  refresh: () => Promise<Progress | null>;
  signOut: () => void;
}
const Ctx = createContext<LearnerState | null>(null);

export function LearnerProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(Boolean(session.get()));
  const [hasSession, setHasSession] = useState(Boolean(session.get()));
  const refresh = useCallback(async () => {
    if (!session.get()) { setHasSession(false); setLoading(false); return null; }
    try {
      const p = await api.get<Progress>('/learners/me');
      setProgress(p);
      setHasSession(true);
      return p;
    } catch (e) {
      // An expired or deleted session starts fresh rather than trapping the learner.
      if (e instanceof ApiError && (e.status === 401 || e.status === 404)) { session.clear(); setHasSession(false); setProgress(null); }
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  const signOut = useCallback(() => { session.clear(); setProgress(null); setHasSession(false); }, []);
  const value = useMemo(() => ({ progress, loading, hasSession, refresh, signOut }), [progress, loading, hasSession, refresh, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLearner() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLearner outside provider');
  return v;
}

// ---------- Toasts ----------
interface ToastMsg { id: number; text: string; tone: 'info' | 'error' }
const ToastCtx = createContext<(text: string, tone?: 'info' | 'error') => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([]);
  const n = useRef(0);
  const show = useCallback((text: string, tone: 'info' | 'error' = 'info') => {
    const id = ++n.current;
    setItems((xs) => [...xs, { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {items.slice(-1).map((t) => <div key={t.id} className={`toast ${t.tone === 'error' ? 'error' : ''}`}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
