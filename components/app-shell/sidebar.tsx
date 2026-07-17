"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";
import { Logo } from "@/components/logo";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/labels";
import type { PersonOption, ProjectOption, WorkstreamOption } from "@/lib/types";

export function Sidebar({
  currentUser,
  people,
  projects,
  workstreams,
}: {
  currentUser: PersonOption;
  people: PersonOption[];
  projects: ProjectOption[];
  workstreams: WorkstreamOption[];
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-none flex-col border-r border-border bg-surface px-3 py-4">
      <div className="px-2 pb-5">
        <Logo variant="full" height={28} />
      </div>

      <div className="mb-4">
        <NewTaskDialog people={people} projects={projects} workstreams={workstreams} />
      </div>

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
          <AvatarFallback>{initials(currentUser.name)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold text-ink">
            {currentUser.name.split(" ")[0]}
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-wide text-muted-2">
            Admin
          </span>
        </div>
      </div>
    </aside>
  );
}
