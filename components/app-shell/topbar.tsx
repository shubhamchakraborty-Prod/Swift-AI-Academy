"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";

export function Topbar({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="flex h-14 flex-none items-center justify-between border-b border-border bg-surface px-6">
      <h1 className="text-[15px] font-bold tracking-tight text-ink">{title}</h1>
      <div className="flex items-center gap-2">
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[13px] text-muted transition-colors hover:bg-surface-2"
        >
          <Search className="size-3.5" />
          Search
          <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-2">
            ⌘K
          </kbd>
        </button>
        {action}
        <ThemeSwitcher />
      </div>
    </header>
  );
}
