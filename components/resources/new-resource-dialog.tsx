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
import { createResource } from "@/lib/actions/resources";
import { RESOURCE_TYPE_LABELS, RESOURCE_TYPE_OPTIONS } from "@/lib/labels";
import type { ResourceType } from "@/generated/prisma/enums";
import type { ProjectOption } from "@/lib/types";

export function NewResourceDialog({ projects }: { projects: ProjectOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [type, setType] = useState<ResourceType>("OTHER");
  const [url, setUrl] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setType("OTHER");
    setUrl("");
    setProjectId(null);
  }

  function submit() {
    if (!title.trim() || !url.trim()) return;
    startTransition(async () => {
      await createResource({ title, type, url, projectId });
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
          New resource
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New resource</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 p-5 pt-0">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resource-title">Title</Label>
            <Input
              id="resource-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Brochure 1st Draft — HEI"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resource-url">Link</Label>
            <Input
              id="resource-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Picker
                options={RESOURCE_TYPE_OPTIONS.map((t) => ({ id: t, label: RESOURCE_TYPE_LABELS[t] }))}
                value={type}
                placeholder="Type"
                onChange={(v) => setType(v as ResourceType)}
              />
            </div>
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
          </div>

          <Button variant="primary" disabled={pending || !title.trim() || !url.trim()} onClick={submit}>
            {pending ? "Adding..." : "Add resource"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
