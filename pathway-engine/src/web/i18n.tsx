/**
 * Language switch (English / Hindi) for learner screens.
 * The choice is kept on the device and sent to the API with every request (x-lang header),
 * so questions, courses and results arrive translated. useI18n().t('key', vars) formats screen text.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STRINGS, type StrKey } from './strings';

export type Lang = 'en' | 'hi';
const KEY = 'swift.lang';

export function currentLang(): Lang {
  try { return localStorage.getItem(KEY) === 'hi' ? 'hi' : 'en'; } catch { return 'en'; }
}

interface I18n { lang: Lang; setLang: (l: Lang) => void; t: (k: StrKey, vars?: Record<string, string | number>) => string; locale: string }
const Ctx = createContext<I18n | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(currentLang());
  useEffect(() => { document.documentElement.lang = lang === 'hi' ? 'hi' : 'en-IN'; }, [lang]);
  const setLang = useCallback((l: Lang) => {
    try { localStorage.setItem(KEY, l); } catch { /* private mode: lasts this session only */ }
    setLangState(l);
  }, []);
  const t = useCallback((k: StrKey, vars?: Record<string, string | number>) => {
    const s = STRINGS[lang][k] ?? STRINGS.en[k];
    return vars ? s.replace(/\{(\w+)\}/g, (_, v: string) => String(vars[v] ?? '')) : s;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t, locale: lang === 'hi' ? 'hi-IN' : 'en-IN' }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside LangProvider');
  return v;
}

/** Compact EN / हिं switch shown in the top bar of every learner screen. */
export function LangToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang-toggle" role="radiogroup" aria-label={t('language')}>
      <button type="button" role="radio" aria-checked={lang === 'en'} lang="en" onClick={() => setLang('en')}>EN</button>
      <button type="button" role="radio" aria-checked={lang === 'hi'} lang="hi" aria-label="हिंदी" onClick={() => setLang('hi')}>हिं</button>
    </div>
  );
}
