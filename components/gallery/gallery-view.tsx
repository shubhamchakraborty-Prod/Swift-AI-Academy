"use client";

import { useState } from "react";
import { GalleryCard } from "@/components/gallery/gallery-card";
import { Badge } from "@/components/ui/badge";
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGE_TONE, RESOURCE_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { ResourceWithRelations } from "@/lib/types";
import type { listProjects } from "@/lib/data/projects";

type Tab = "projects" | "resources";
type ProjectSummary = Awaited<ReturnType<typeof listProjects>>[number];

export function GalleryView({
  projects,
  resources,
}: {
  projects: ProjectSummary[];
  resources: ResourceWithRelations[];
}) {
  const [tab, setTab] = useState<Tab>("projects");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-full border border-border bg-surface p-1 w-fit">
        {(["projects", "resources"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-4 py-1.5 text-[13px] font-medium capitalize transition-colors",
              tab === t ? "bg-primary text-white" : "text-muted hover:bg-surface-2"
            )}
          >
            {t} · {t === "projects" ? projects.length : resources.length}
          </button>
        ))}
      </div>

      {tab === "projects" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.length === 0 && (
            <p className="text-sm text-muted">No projects yet.</p>
          )}
          {projects.map((project) => (
            <GalleryCard
              key={project.id}
              seed={project.id}
              title={project.name}
              subtitle={project.description ?? undefined}
            >
              <div className="flex flex-wrap gap-1.5">
                {project.pipelineStage ? (
                  <Badge tone={PIPELINE_STAGE_TONE[project.pipelineStage]}>
                    {PIPELINE_STAGE_LABELS[project.pipelineStage]}
                  </Badge>
                ) : (
                  <Badge tone="success">Delivery</Badge>
                )}
                {project.instituteTypes.map((type) => (
                  <Badge key={type} tone="neutral">
                    {type}
                  </Badge>
                ))}
              </div>
            </GalleryCard>
          ))}
        </div>
      )}

      {tab === "resources" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resources.length === 0 && (
            <p className="text-sm text-muted">No resources yet.</p>
          )}
          {resources.map((resource) => (
            <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer">
              <GalleryCard seed={resource.id} title={resource.title} subtitle={resource.project?.name}>
                <Badge tone="primary">{RESOURCE_TYPE_LABELS[resource.type]}</Badge>
              </GalleryCard>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
