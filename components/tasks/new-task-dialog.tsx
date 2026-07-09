"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Picker } from "@/components/tasks/picker";
import { createTask } from "@/lib/actions/tasks";
import { PRIORITY_LABELS, PRIORITY_OPTIONS } from "@/lib/labels";
import type { Priority } from "@/generated/prisma/enums";
import type { PersonOption, ProjectOption, WorkstreamOption } from "@/lib/types";

export function NewTaskDialog({
  people,
  projects,
  workstreams,
}: {
  people: PersonOption[];
  projects: ProjectOption[];
  workstreams: WorkstreamOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [workstreamId, setWorkstreamId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>("NOT_PRIORITISED");
  const [dueDate, setDueDate] = useState("");

  function reset() {
    setTitle("");
    setProjectId(null);
    setWorkstreamId(null);
    setOwnerId(null);
    setPriority("NOT_PRIORITISED");
    setDueDate("");
  }

  function submit() {
    if (!title.trim()) return;
    startTransition(async () => {
      await createTask({
        title,
        projectId,
        workstreamId,
        ownerId,
        priority,
        dueDate: dueDate || null,
      });
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm" className="w-full justify-center">
          <Plus />
          New task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 p-5 pt-0">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to get done?"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Project</Label>
              <Picker
                options={projects.map((p) => ({ id: p.id, label: p.name }))}
                value={projectId}
                placeholder="No project"
                allowClear
                onChange={(v) => setProjectId(v || null)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Workstream</Label>
              <Picker
                options={workstreams.map((w) => ({ id: w.id, label: w.name }))}
                value={workstreamId}
                placeholder="No workstream"
                allowClear
                onChange={(v) => setWorkstreamId(v || null)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Owner</Label>
              <Picker
                options={people.map((p) => ({ id: p.id, label: p.name }))}
                value={ownerId}
                placeholder="Unassigned"
                allowClear
                onChange={(v) => setOwnerId(v || null)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Priority</Label>
              <Picker
                options={PRIORITY_OPTIONS.map((p) => ({ id: p, label: PRIORITY_LABELS[p] }))}
                value={priority}
                placeholder="Priority"
                onChange={(v) => setPriority(v as Priority)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-due">Due date</Label>
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <Button variant="primary" disabled={pending || !title.trim()} onClick={submit}>
            {pending ? "Creating..." : "Create task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
