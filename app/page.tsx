import { AlertTriangle, CheckCircle2, Clock, ListTodo } from "lucide-react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { CommandPalette } from "@/components/command-palette";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATS = [
  {
    label: "Overdue",
    value: 0,
    icon: AlertTriangle,
    iconWrap: "bg-danger-tint",
    iconColor: "text-danger",
  },
  {
    label: "Due this week",
    value: 0,
    icon: Clock,
    iconWrap: "bg-warning-tint",
    iconColor: "text-warning",
  },
  {
    label: "In progress",
    value: 0,
    icon: ListTodo,
    iconWrap: "bg-primary-tint",
    iconColor: "text-primary",
  },
  {
    label: "Completed",
    value: 0,
    icon: CheckCircle2,
    iconWrap: "bg-success-tint",
    iconColor: "text-success",
  },
];

export default function Home() {
  return (
    <div className="flex h-screen w-full">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title="My Tasks" />
        <main className="flex-1 overflow-y-auto bg-bg p-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STATS.map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <span className={`flex size-9 items-center justify-center rounded-xl ${stat.iconWrap}`}>
                      <stat.icon className={`size-4.5 ${stat.iconColor}`} />
                    </span>
                    <div>
                      <div className="font-mono text-xl font-bold text-ink">{stat.value}</div>
                      <div className="text-[12.5px] text-muted">{stat.label}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <Badge tone="primary">Phase 0 — Foundation</Badge>
                <h2 className="text-lg font-bold text-ink">
                  Vector&rsquo;s design system is live. Tasks and projects come next.
                </h2>
                <p className="max-w-md text-sm text-muted">
                  This screen is the app shell — theming, navigation, and the command
                  palette (press{" "}
                  <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">⌘K</kbd>
                  ) are wired up. Projects, tasks and the rest of the views land in Phase 1.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
