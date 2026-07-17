import { Topbar } from "@/components/app-shell/topbar";
import { GalleryView } from "@/components/gallery/gallery-view";
import { NewResourceDialog } from "@/components/resources/new-resource-dialog";
import { listProjects } from "@/lib/data/projects";
import { listResources } from "@/lib/data/resources";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const [projects, resources] = await Promise.all([listProjects(), listResources()]);

  return (
    <>
      <Topbar
        title="Gallery"
        action={<NewResourceDialog projects={projects.map((p) => ({ id: p.id, name: p.name }))} />}
      />
      <main className="flex-1 overflow-y-auto bg-bg p-6">
        <GalleryView projects={projects} resources={resources} />
      </main>
    </>
  );
}
