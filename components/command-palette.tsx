"use client";

import * as React from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { NAV_ITEMS } from "@/lib/nav";
import { THEMES } from "@/lib/themes";

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (href: string) => {
    router.push(href);
    setOpen(false);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command menu"
      className="fixed left-1/2 top-[18%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-card border border-border bg-surface shadow-[var(--shadow-2)]"
      overlayClassName="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]"
    >
      <Command.Input
        placeholder="Search or jump to..."
        className="w-full border-b border-border bg-transparent px-4 py-3.5 text-sm text-ink outline-none placeholder:text-muted-2"
      />
      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted">
          No results found.
        </Command.Empty>

        <Command.Group
          heading="Go to"
          className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-2"
        >
          {NAV_ITEMS.map((item) => (
            <Command.Item
              key={item.href}
              onSelect={() => go(item.href)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink data-[selected=true]:bg-surface-2"
            >
              <item.icon className="size-4 text-muted" />
              {item.label}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group
          heading="Theme"
          className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-2"
        >
          {THEMES.map((t) => (
            <Command.Item
              key={t.value}
              onSelect={() => {
                setTheme(t.value);
                setOpen(false);
              }}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink data-[selected=true]:bg-surface-2"
            >
              <span className="size-3 rounded-full border border-border" style={{ background: t.swatch }} />
              Switch to {t.label}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
