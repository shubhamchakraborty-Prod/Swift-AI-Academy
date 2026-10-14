/**
 * Shared UI building blocks (design system in styles/tokens.css and styles/app.css).
 * Patterns follow familiar mobile apps: top bar with back and the language switch, sticky bottom action,
 * story-style progress, bottom sheets for details. Learner screens are built to fit one phone screen.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Check, ChevronLeft, X } from 'lucide-react';
import { useI18n, LangToggle } from '../i18n';

/**
 * Swift AI Academy mark (connected learning nodes). Source: the supplied Illustrator master,
 * exported to public/logo-mark.svg (mark only) and public/logo-full.svg (stacked lockup with wordmark).
 * To update the logo, replace those two files; nothing else needs to change.
 */
export function Logo({ size = 32 }: { size?: number }) {
  return <img src="/logo-mark.svg" alt="" height={size} width={Math.round((size * 1442) / 1295)} style={{ display: 'block' }} />;
}

export function Brand({ compact }: { compact?: boolean }) {
  return <span className="brand"><Logo size={compact ? 26 : 30} /><span className="brand-name">Swift AI Academy</span></span>;
}

/** Top bar: back on the left, title in the middle, language switch (or a custom action) on the right. */
export function AppBar({ title, sub, back, onBack, right, lang = true }: { title?: ReactNode; sub?: string; back?: string | false; onBack?: () => void; right?: ReactNode; lang?: boolean }) {
  const nav = useNavigate();
  const { t } = useI18n();
  const canGoBack = back !== false && (back || onBack);
  return (
    <header className="appbar">
      <div>
        {canGoBack ? <button className="icon-btn" aria-label={t('back')} onClick={() => (onBack ? onBack() : nav(back as string))}><ChevronLeft size={24} strokeWidth={2} /></button> : null}
      </div>
      <div className="appbar-title">
        {sub ? <span className="appbar-sub">{sub}</span> : null}
        {title}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>{right}{lang ? <LangToggle /> : null}</div>
    </header>
  );
}

/** Brand header used on Welcome and the home tabs. */
export function BrandBar() {
  return (
    <header className="appbar" style={{ gridTemplateColumns: '1fr auto' }}>
      <div style={{ paddingLeft: 8 }}><Brand compact /></div>
      <div style={{ paddingRight: 8 }}><LangToggle /></div>
    </header>
  );
}

export function ActionBar({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return <div className="actionbar">{children}{hint ? <p className="hint">{hint}</p> : null}</div>;
}

const PART_KEYS = ['part_about', 'part_profile', 'part_skills', 'part_goals'] as const;

/** Instagram-style segmented progress for the four assessment parts. */
export function Stories({ part, fraction, saved }: { part: 0 | 1 | 2 | 3; fraction: number; saved?: boolean }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="stories" role="progressbar" aria-label={`${t(PART_KEYS[part])}, ${t('partOf', { n: part + 1 })}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(((part + fraction) / 4) * 100)}>
        {PART_KEYS.map((k, i) => <div className="seg" key={k}><i style={{ width: `${i < part ? 100 : i === part ? Math.max(4, fraction * 100) : 0}%` }} /></div>)}
      </div>
      <div className="progress-meta">
        <span>{t('partOf', { n: part + 1 })} · {t(PART_KEYS[part])}</span>
        {saved ? <span className="saved"><Check size={14} strokeWidth={2.5} /> {t('saved')}</span> : <span />}
      </div>
    </div>
  );
}

export function Choice({ label, help, selected, onSelect, multi, order, disabled }: { label: ReactNode; help?: ReactNode; selected: boolean; onSelect: () => void; multi?: boolean; order?: string; disabled?: boolean }) {
  return (
    <button type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={selected} className={`choice ${multi ? 'square' : ''}`} onClick={onSelect} disabled={disabled}>
      <span className="tick" aria-hidden="true">{selected ? <Check size={15} strokeWidth={3} /> : null}</span>
      <span className="choice-label">{label}{help ? <span className="choice-help">{help}</span> : null}</span>
      {order ? <span className="badge-order">{order}</span> : null}
    </button>
  );
}

/** Layout for an option list: 2 columns when there are many short options, tighter rows when there are many long ones. */
export function choicesClass(labels: string[]) {
  if (labels.length > 8) return 'choices grid2 long';
  if (labels.length > 6 && labels.every((l) => l.length <= 24)) return 'choices grid2';
  if (labels.length > 5) return 'choices dense';
  return 'choices';
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="field-error" role="alert"><AlertCircle size={16} />{children}</p>;
}

export function Loading({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="content center" style={{ alignItems: 'center', gap: 16 }} aria-busy="true">
      <div className="spinner" />
      <p className="muted">{label ?? t('loading')}</p>
    </div>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

/** Bottom sheet: the familiar mobile pattern for details, so screens stay one page tall. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; prev?.focus(); };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        <div className="row" style={{ marginBottom: 12, alignItems: 'flex-start' }}>
          <h2 style={{ flex: 1, fontSize: 20 }}>{title}</h2>
          <button className="icon-btn" aria-label={t('close')} onClick={onClose}><X size={22} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** 8-step level meter: what the learner has, what the plan adds, what is still needed. */
export function LevelMeter({ have, gain = have, need, label }: { have: number; gain?: number; need?: number; label: string }) {
  return (
    <div className="levels" role="img" aria-label={label}>
      {Array.from({ length: 8 }, (_, i) => {
        const lvl = i + 1;
        const cls = lvl <= Math.floor(have) ? 'have' : lvl <= Math.ceil(gain) ? 'gain' : need !== undefined && lvl <= Math.ceil(need) ? 'need' : '';
        return <i key={i} className={cls} />;
      })}
    </div>
  );
}
