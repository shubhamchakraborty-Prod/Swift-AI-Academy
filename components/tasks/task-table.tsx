"use client";

import { useState } from "react";
import { StatusSelect } from "@/components/tasks/status-select";
import { PrioritySelect } from "@/components/tasks/priority-select";
import { OwnerSelect } from "@/components/tasks/owner-select";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { isOverdue } from "@/lib/task-utils";
import type { PersonOption, TaskWithRelations } from "@/lib/types";

export function TaskTable({
  tasks,
  people,
}: {
  tasks: TaskWithRelations[];
  people: PersonOption[];
}) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;

  if (tasks.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface p-16 text-center">
        <p className="text-sm text-muted">
          No tasks yet — create the first one with the button in the sidebar.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-3 font-mono text-[10.5px] uppercase tracking-wide text-muted-2">
              Task
            </th>
            <th className="px-4 py-3 font-mono text-[10.5px] uppercase tracking-wide text-muted-2">
              Owner
            </th>
            <th className="px-4 py-3 font-mono text-[10.5px] uppercase tracking-wide text-muted-2">
              Priority
            </th>
            <th className="px-4 py-3 font-mono text-[10.5px] uppercase tracking-wide text-muted-2">
              Status
            </th>
            <th className="px-4 py-3 font-mono text-[10.5px] uppercase tracking-wide text-muted-2">
              Due
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const overdue = isOverdue(task);
            return (
              <tr key={task.id} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                <td className="max-w-xs px-4 py-3">
                  <button
                    onClick={() => setOpenTaskId(task.id)}
                    className="text-left font-medium text-ink hover:text-primary"
                  >
                    {task.title}
                  </button>
                  {task.project && (
                    <div className="font-mono text-[10.5px] uppercase tracking-wide text-muted-2">
                      {task.project.name}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <OwnerSelect taskId={task.id} value={task.ownerId} people={people} />
                </td>
                <td className="px-4 py-3">
                  <PrioritySelect taskId={task.id} value={task.priority} />
                </td>
                <td className="px-4 py-3">
                  <StatusSelect taskId={task.id} value={task.status} />
                </td>
                <td className="px-4 py-3">
                  {task.dueDate ? (
                    <span className={overdue ? "font-mono text-[12.5px] font-semibold text-danger" : "font-mono text-[12.5px] text-muted"}>
                      {new Date(task.dueDate).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                      {overdue && " · overdue"}
                    </span>
                  ) : (
                    <span className="text-muted-2">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <TaskDetailSheet
        task={openTask}
        people={people}
        open={openTaskId !== null}
        onOpenChange={(open) => !open && setOpenTaskId(null)}
      />
    </div>
  );
}
