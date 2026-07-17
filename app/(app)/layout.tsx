import { Sidebar } from "@/components/app-shell/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { listProjects } from "@/lib/data/projects";
import { listPeople, listWorkstreams } from "@/lib/data/people";
import { getCurrentUser } from "@/lib/current-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [people, projects, workstreams, currentUser] = await Promise.all([
    listPeople(),
    listProjects(),
    listWorkstreams(),
    getCurrentUser(),
  ]);

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentUser={currentUser} people={people} projects={projects} workstreams={workstreams} />
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      <CommandPalette />
    </div>
  );
}
