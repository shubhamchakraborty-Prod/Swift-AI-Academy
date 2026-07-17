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
import { createProject } from "@/lib/actions/projects";
import { INSTITUTE_TYPES } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { PersonOption } from "@/lib/types";

export function NewProjectDialog({ people }: { people: PersonOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instituteTypes, setInstituteTypes] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  function reset() {
    setName("");
    setDescription("");
    setInstituteTypes([]);
    setOwnerId(null);
  }

  function toggleType(type: string) {
    setInstituteTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function submit() {
    if (!name.trim()) return;
    startTransition(async () => {
      await createProject({ name, description, instituteTypes, ownerId });
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 p-5 pt-0">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AVGC-XR Tripura"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-description">About</Label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this project?"
              className="resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted-2 focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Institute type</Label>
            <div className="flex flex-wrap gap-1.5">
              {INSTITUTE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={cn(
                    "rounded-tag border px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                    instituteTypes.includes(type)
                      ? "border-primary bg-primary-tint text-primary"
                      : "border-border text-muted hover:bg-surface-2"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
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

          <Button variant="primary" disabled={pending || !name.trim()} onClick={submit}>
            {pending ? "Creating..." : "Create project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
