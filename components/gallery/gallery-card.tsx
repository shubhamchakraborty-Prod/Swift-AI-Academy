import type { ReactNode } from "react";

const COVER_HUES = [
  "linear-gradient(135deg, #EAEEFF, #FFFFFF)",
  "linear-gradient(135deg, #DCF0F4, #FFFFFF)",
  "linear-gradient(135deg, #EBE1FA, #FFFFFF)",
  "linear-gradient(135deg, #FCDFE9, #FFFFFF)",
  "linear-gradient(135deg, #FFF4DC, #FFFFFF)",
];

function hashSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function GalleryCard({
  seed,
  title,
  subtitle,
  children,
}: {
  seed: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  const cover = COVER_HUES[hashSeed(seed) % COVER_HUES.length];

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-[var(--shadow-1)] transition-shadow hover:shadow-[var(--shadow-2)]">
      <div className="h-24 w-full" style={{ background: cover }} />
      <div className="p-3.5">
        <div className="mb-0.5 text-[13.5px] font-semibold leading-snug text-ink">{title}</div>
        {subtitle && <div className="mb-2 text-[12px] text-muted">{subtitle}</div>}
        {children}
      </div>
    </div>
  );
}
