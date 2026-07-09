"use client";

import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusSelect } from "@/components/tasks/status-select";
import { PrioritySelect } from "@/components/tasks/priority-select";
import { OwnerSelect } from "@/components/tasks/owner-select";
import { AddCommentForm } from "@/components/tasks/add-comment-form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/labels";
import type { PersonOption, TaskWithRelations } from "@/lib/types";

export function TaskDetailSheet({
  task,
  people,
  open,
  onOpenChange,
}: {
  task: TaskWithRelations | null;
  people: PersonOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{task.title}</SheetTitle>
          {task.project && (
            <span className="font-mono text-[10.5px] uppercase tracking-wide text-muted-2">
              {task.project.name}
            </span>
          )}
        </SheetHeader>

        <SheetBody className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10.5px] uppercase tracking-wide text-muted-2">Status</span>
              <StatusSelect taskId={task.id} value={task.status} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10.5px] uppercase tracking-wide text-muted-2">Priority</span>
              <PrioritySelect taskId={task.id} value={task.priority} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10.5px] uppercase tracking-wide text-muted-2">Owner</span>
              <OwnerSelect taskId={task.id} value={task.ownerId} people={people} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10.5px] uppercase tracking-wide text-muted-2">Due date</span>
              <span className="text-sm text-ink">
                {task.dueDate
                  ? new Date(task.dueDate).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "No due date"}
              </span>
            </div>
          </div>

          {task.workstream && (
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10.5px] uppercase tracking-wide text-muted-2">Workstream</span>
              <span className="text-sm text-ink">{task.workstream.name}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <span className="font-mono text-[10.5px] uppercase tracking-wide text-muted-2">Activity</span>
            {task.comments.length === 0 && (
              <p className="text-sm text-muted">No comments yet.</p>
            )}
            {task.comments.map((comment) => (
              <div key={comment.id} className="flex gap-2.5">
                <Avatar>
                  <AvatarFallback>{initials(comment.author.name)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold text-ink">{comment.author.name}</span>
                    <span className="text-[11px] text-muted-2">
                      {new Date(comment.createdAt).toLocaleString(undefined, {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p
                    className={
                      comment.kind === "ACTIVITY"
                        ? "text-[13px] italic text-muted"
                        : "text-[13.5px] text-ink-soft"
                    }
                  >
                    {comment.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SheetBody>

        <SheetFooter>
          <AddCommentForm taskId={task.id} />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
