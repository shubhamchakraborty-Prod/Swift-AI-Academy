import { prisma } from "@/lib/prisma";
import { isOverdue } from "@/lib/task-utils";

export const TASK_LIST_INCLUDE = {
  project: { select: { id: true, name: true } },
  workstream: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  subtasks: { select: { id: true, status: true } },
  comments: {
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  },
} as const;

export async function listTasks() {
  const tasks = await prisma.task.findMany({
    where: { parentTaskId: null },
    include: TASK_LIST_INCLUDE,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });
  return tasks;
}

export async function taskStats() {
  const tasks = await listTasks();
  const overdue = tasks.filter((t) => isOverdue(t)).length;
  const weekFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const dueThisWeek = tasks.filter(
    (t) =>
      t.dueDate &&
      !isOverdue(t) &&
      t.status !== "COMPLETED" &&
      t.status !== "SCRAPPED" &&
      t.dueDate.getTime() <= weekFromNow
  ).length;
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const completed = tasks.filter((t) => t.status === "COMPLETED").length;
  return { overdue, dueThisWeek, inProgress, completed };
}
