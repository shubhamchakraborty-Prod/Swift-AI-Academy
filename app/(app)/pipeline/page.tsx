import { Topbar } from "@/components/app-shell/topbar";
import { PipelineView } from "@/components/projects/pipeline-view";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { listPipelineProjects } from "@/lib/data/projects";
import { listPeople } from "@/lib/data/people";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [projects, people] = await Promise.all([listPipelineProjects(), listPeople()]);

  return (
    <>
      <Topbar title="Pipeline" action={<NewProjectDialog people={people} />} />
      <main className="flex-1 overflow-y-auto bg-bg p-6">
        <PipelineView projects={projects} />
      </main>
    </>
  );
}
