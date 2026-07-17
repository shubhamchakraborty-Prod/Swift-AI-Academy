"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { updateTaskField } from "@/lib/actions/tasks";
import { STATUS_LABELS, STATUS_OPTIONS, STATUS_TONE, PRIORITY_LABELS, PRIORITY_TONE, initials } from "@/lib/labels";
import { isOverdue } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import type { PersonOption, TaskWithRelations } from "@/lib/types";
import type { TaskStatus } from "@/generated/prisma/enums";

function TaskCard({ task, onOpen }: { task: TaskWithRelations; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      className={cn(
        "mb-2 cursor-pointer rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-1)] transition-shadow hover:shadow-[var(--shadow-2)]",
        isDragging && "z-10 opacity-60"
      )}
    >
      {task.project && (
        <div className="mb-1 font-mono text-[9.5px] uppercase tracking-wide text-muted-2">
          {task.project.name}
        </div>
      )}
      <div className="mb-2 text-[12.5px] font-semibold leading-snug text-ink">{task.title}</div>
      <div className="flex items-center justify-between">
        <Badge tone={PRIORITY_TONE[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
        {task.owner ? (
          <Avatar>
            <AvatarFallback>{initials(task.owner.name)}</AvatarFallback>
          </Avatar>
        ) : null}
      </div>
      {isOverdue(task) && (
        <div className="mt-1.5 font-mono text-[10px] font-bold text-danger">Overdue</div>
      )}
    </div>
  );
}

function Column({
  status,
  tasks,
  onOpen,
}: {
  status: string;
  tasks: TaskWithRelations[];
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-64 flex-none flex-col rounded-2xl border border-border bg-surface-2/40 p-2.5",
        isOver && "ring-2 ring-primary"
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>
        <span className="font-mono text-[11px] text-muted-2">{tasks.length}</span>
      </div>
      <div className="min-h-8">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onOpen={() => onOpen(task.id)} />
        ))}
      </div>
    </div>
  );
}

export function BoardView({
  tasks,
  people,
}: {
  tasks: TaskWithRelations[];
  people: PersonOption[];
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;
  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const task = tasks.find((t) => t.id === active.id);
    if (!task || task.status === over.id) return;
    await updateTaskField(task.id, { status: over.id as TaskStatus });
    router.refresh();
  }

  return (
    <DndContext
      id="board"
      sensors={sensors}
      onDragStart={(e) => setActiveId(e.active.id as string)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUS_OPTIONS.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={tasks.filter((t) => t.status === status)}
            onOpen={setOpenTaskId}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="w-64 rounded-xl border border-primary bg-surface p-3 shadow-[var(--shadow-2)]">
            <div className="text-[12.5px] font-semibold text-ink">{activeTask.title}</div>
          </div>
        ) : null}
      </DragOverlay>

      <TaskDetailSheet
        task={openTask}
        people={people}
        open={openTaskId !== null}
        onOpenChange={(open) => !open && setOpenTaskId(null)}
      />
    </DndContext>
  );
}
