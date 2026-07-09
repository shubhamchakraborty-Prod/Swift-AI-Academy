"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-none flex-col border-r border-border bg-surface px-3 py-4">
      <div className="px-2 pb-5">
        <Logo variant="full" height={28} />
      </div>

      <Button variant="primary" size="sm" className="mb-4 w-full justify-center">
        <Plus />
        New task
      </Button>

      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink",
                active && "bg-primary-tint text-primary"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
        <Avatar>
          <AvatarFallback>SC</AvatarFallback>
        </Avatar>
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold text-ink">Shubham</span>
          <span className="font-mono text-[10.5px] uppercase tracking-wide text-muted-2">
            Admin
          </span>
        </div>
      </div>
    </aside>
  );
}
