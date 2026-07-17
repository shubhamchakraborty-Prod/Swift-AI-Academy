import { Topbar } from "@/components/app-shell/topbar";
import { BoardView } from "@/components/tasks/board-view";
import { listTasks } from "@/lib/data/tasks";
import { listPeople } from "@/lib/data/people";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const [tasks, people] = await Promise.all([listTasks(), listPeople()]);

  return (
    <>
      <Topbar title="Board" />
      <main className="flex-1 overflow-y-auto bg-bg p-6">
        <BoardView tasks={tasks} people={people} />
      </main>
    </>
  );
}
