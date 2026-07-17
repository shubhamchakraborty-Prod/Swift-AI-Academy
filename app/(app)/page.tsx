import { AlertTriangle, CheckCircle2, Clock, ListTodo } from "lucide-react";
import { Topbar } from "@/components/app-shell/topbar";
import { TaskTable } from "@/components/tasks/task-table";
import { Card, CardContent } from "@/components/ui/card";
import { listTasks, taskStats } from "@/lib/data/tasks";
import { listPeople } from "@/lib/data/people";

export const dynamic = "force-dynamic";

export default async function MyTasksPage() {
  const [tasks, stats, people] = await Promise.all([listTasks(), taskStats(), listPeople()]);

  const STATS = [
    { label: "Overdue", value: stats.overdue, icon: AlertTriangle, iconWrap: "bg-danger-tint", iconColor: "text-danger" },
    { label: "Due this week", value: stats.dueThisWeek, icon: Clock, iconWrap: "bg-warning-tint", iconColor: "text-warning" },
    { label: "In progress", value: stats.inProgress, icon: ListTodo, iconWrap: "bg-primary-tint", iconColor: "text-primary" },
    { label: "Completed", value: stats.completed, icon: CheckCircle2, iconWrap: "bg-success-tint", iconColor: "text-success" },
  ];

  return (
    <>
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

          <TaskTable tasks={tasks} people={people} />
        </div>
      </main>
    </>
  );
}
