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
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { updateProjectStage, convertProject } from "@/lib/actions/projects";
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGE_OPTIONS, PIPELINE_STAGE_TONE, initials } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { ProjectWithRelations } from "@/lib/types";
import type { PipelineStage } from "@/generated/prisma/enums";

function ProjectCard({ project }: { project: ProjectWithRelations }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: project.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      className={cn(
        "mb-2 cursor-grab rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-1)] transition-shadow hover:shadow-[var(--shadow-2)]",
        isDragging && "z-10 opacity-60"
      )}
    >
      <div className="mb-1.5 text-[13px] font-semibold leading-snug text-ink">{project.name}</div>
      {project.description && (
        <p className="mb-2 line-clamp-2 text-[12px] text-muted">{project.description}</p>
      )}
      {project.instituteTypes.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {project.instituteTypes.map((type) => (
            <Badge key={type} tone="neutral">
              {type}
            </Badge>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10.5px] text-muted-2">
          {project._count.tasks} tasks · {project._count.resources} files
        </span>
        {project.owner && (
          <Avatar>
            <AvatarFallback>{initials(project.owner.name)}</AvatarFallback>
          </Avatar>
        )}
      </div>
      {project.pipelineStage === "ACCEPTED" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            convertProject(project.id).then(() => router.refresh());
          }}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[12px] font-bold text-ink transition-colors hover:brightness-95"
        >
          Convert to project <ArrowRight className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function Column({ stage, projects }: { stage: string; projects: ProjectWithRelations[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 flex-none flex-col rounded-2xl border border-border bg-surface-2/40 p-2.5",
        isOver && "ring-2 ring-primary"
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <Badge tone={PIPELINE_STAGE_TONE[stage]}>{PIPELINE_STAGE_LABELS[stage]}</Badge>
        <span className="font-mono text-[11px] text-muted-2">{projects.length}</span>
      </div>
      <div className="min-h-8">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}

export function PipelineView({ projects }: { projects: ProjectWithRelations[] }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const activeProject = projects.find((p) => p.id === activeId) ?? null;

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const project = projects.find((p) => p.id === active.id);
    if (!project || project.pipelineStage === over.id) return;
    await updateProjectStage(project.id, over.id as PipelineStage);
    router.refresh();
  }

  return (
    <DndContext
      id="pipeline"
      sensors={sensors}
      onDragStart={(e) => setActiveId(e.active.id as string)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGE_OPTIONS.map((stage) => (
          <Column key={stage} stage={stage} projects={projects.filter((p) => p.pipelineStage === stage)} />
        ))}
      </div>

      <DragOverlay>
        {activeProject ? (
          <div className="w-72 rounded-xl border border-primary bg-surface p-3 shadow-[var(--shadow-2)]">
            <div className="text-[13px] font-semibold text-ink">{activeProject.name}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
