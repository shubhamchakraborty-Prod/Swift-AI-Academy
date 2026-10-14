/** Thin typed client for the /v1 API. Errors carry the server's plain-language message. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details: any) {
    super(message);
  }
}

import { currentLang } from './i18n';

const TOKEN_KEY = 'swift.pathway.session';
const STAFF_KEY = 'swift.pathway.staff';

export interface Session { learnerId: string; token: string }

export const session = {
  get(): Session | null {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null'); } catch { return null; }
  },
  set(s: Session) { try { localStorage.setItem(TOKEN_KEY, JSON.stringify(s)); } catch { /* private mode: session lasts this tab only */ } },
  clear() { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};
export const staffSession = {
  get(): { token: string; role: 'mentor' | 'admin' } | null {
    try { return JSON.parse(sessionStorage.getItem(STAFF_KEY) ?? 'null'); } catch { return null; }
  },
  set(v: { token: string; role: 'mentor' | 'admin' }) { try { sessionStorage.setItem(STAFF_KEY, JSON.stringify(v)); } catch { /* ignore */ } },
  clear() { try { sessionStorage.removeItem(STAFF_KEY); } catch { /* ignore */ } },
};

export async function request<T = any>(method: string, path: string, body?: unknown, opts: { staff?: boolean; signal?: AbortSignal } = {}): Promise<T> {
  // The server returns questions, courses and results in this language.
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-lang': opts.staff ? 'en' : currentLang() };
  const token = opts.staff ? staffSession.get()?.token : session.get()?.token;
  if (token) headers.authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`/v1${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: opts.signal });
  } catch {
    throw new ApiError(0, 'offline', 'You seem to be offline. Your earlier answers are saved. Check your connection and try again.', null);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.error ?? 'error', json?.message ?? 'Something went wrong. Please try again.', json?.details ?? null);
  return json as T;
}

export const api = {
  get: <T = any>(p: string, o?: { staff?: boolean }) => request<T>('GET', p, undefined, o),
  post: <T = any>(p: string, b?: unknown, o?: { staff?: boolean }) => request<T>('POST', p, b ?? {}, o),
  patch: <T = any>(p: string, b?: unknown) => request<T>('PATCH', p, b),
  del: <T = any>(p: string) => request<T>('DELETE', p),
};

/** Measures how long a learner spends on one screen (sent as ms_taken). */
export function screenTimer() {
  let start = Date.now();
  return { elapsed: () => Date.now() - start, reset: () => { start = Date.now(); } };
}
