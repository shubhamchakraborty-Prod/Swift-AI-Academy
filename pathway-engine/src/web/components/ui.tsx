/**
 * Shared UI building blocks (design system in styles/tokens.css and styles/app.css).
 * Patterns follow familiar mobile apps: top bar with back, sticky bottom action, story-style progress, bottom sheets.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Check, ChevronLeft, X } from 'lucide-react';
import { PARTS } from '../journey';

/**
 * Swift AI Academy mark (connected learning nodes). Source: the supplied Illustrator master,
 * exported to public/logo-mark.svg (mark only) and public/logo-full.svg (stacked lockup with wordmark).
 * To update the logo, replace those two files; nothing else needs to change.
 */
export function Logo({ size = 32 }: { size?: number }) {
  return <img src="/logo-mark.svg" alt="" height={size} width={Math.round((size * 1442) / 1295)} style={{ display: 'block' }} />;
}

export function Brand() {
  return (
    <span className="brand"><Logo size={30} /><span className="brand-name">Swift AI Academy</span></span>
  );
}

/** Top bar: back on the left, title in the middle, optional action on the right. */
export function AppBar({ title, sub, back, onBack, right }: { title?: ReactNode; sub?: string; back?: string | false; onBack?: () => void; right?: ReactNode }) {
  const nav = useNavigate();
  const canGoBack = back !== false && (back || onBack);
  return (
    <header className="appbar">
      <div>
        {canGoBack ? (
          <button className="icon-btn" aria-label="Go back" onClick={() => (onBack ? onBack() : nav(back as string))}><ChevronLeft size={24} strokeWidth={2} /></button>
        ) : null}
      </div>
      <div className="appbar-title">
        {sub ? <span className="appbar-sub">{sub}</span> : null}
        {title}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </header>
  );
}

export function ActionBar({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return <div className="actionbar">{children}{hint ? <p className="hint">{hint}</p> : null}</div>;
}

/** Instagram-style segmented progress for the four assessment parts. */
export function Stories({ part, fraction, saved }: { part: 0 | 1 | 2 | 3; fraction: number; saved?: boolean }) {
  return (
    <div>
      <div className="stories" role="progressbar" aria-label={`${PARTS[part].label}, part ${part + 1} of 4`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(((part + fraction) / 4) * 100)}>
        {PARTS.map((p, i) => (
          <div className="seg" key={p.key}><i style={{ width: `${i < part ? 100 : i === part ? Math.max(4, fraction * 100) : 0}%` }} /></div>
        ))}
      </div>
      <div className="progress-meta">
        <span>Part {part + 1} of 4 · {PARTS[part].label}</span>
        {saved ? <span className="saved"><Check size={14} strokeWidth={2.5} /> Saved</span> : <span />}
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

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="field-error" role="alert"><AlertCircle size={16} />{children}</p>;
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="content center" style={{ alignItems: 'center', gap: 16 }} aria-busy="true">
      <div className="spinner" />
      <p className="muted">{label}</p>
    </div>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/** Bottom sheet, the familiar mobile pattern for details and confirmations. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 style={{ flex: 1 }}>{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={22} /></button>
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
