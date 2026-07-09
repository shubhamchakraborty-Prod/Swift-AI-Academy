"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import type { Priority, TaskStatus } from "@/generated/prisma/enums";

function revalidateTaskViews() {
  revalidatePath("/");
  revalidatePath("/board");
}

export async function createTask(input: {
  title: string;
  projectId?: string | null;
  workstreamId?: string | null;
  ownerId?: string | null;
  priority?: Priority;
  dueDate?: string | null;
}) {
  if (!input.title.trim()) {
    throw new Error("Title is required.");
  }

  const task = await prisma.task.create({
    data: {
      title: input.title.trim(),
      projectId: input.projectId || null,
      workstreamId: input.workstreamId || null,
      ownerId: input.ownerId || null,
      priority: input.priority ?? "NOT_PRIORITISED",
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    },
  });

  revalidateTaskViews();
  return task;
}

const FIELD_LABELS: Record<string, string> = {
  status: "status",
  priority: "priority",
  ownerId: "owner",
  dueDate: "due date",
  title: "title",
};

export async function updateTaskField(
  taskId: string,
  patch: Partial<{
    title: string;
    status: TaskStatus;
    priority: Priority;
    ownerId: string | null;
    dueDate: string | null;
  }>
) {
  const current = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  const actor = await getCurrentUser();

  const data: Record<string, unknown> = { ...patch };
  if ("dueDate" in patch) {
    data.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
  }
  if (patch.status === "COMPLETED" && current.status !== "COMPLETED") {
    data.completedAt = new Date();
  }
  if (patch.status && patch.status !== "COMPLETED") {
    data.completedAt = null;
  }

  const updated = await prisma.task.update({ where: { id: taskId }, data });

  const changedFields = Object.keys(patch).filter(
    (key) => (current as Record<string, unknown>)[key] !== (patch as Record<string, unknown>)[key]
  );
  if (changedFields.length > 0) {
    const summary = changedFields.map((f) => FIELD_LABELS[f] ?? f).join(", ");
    await prisma.comment.create({
      data: {
        taskId,
        authorId: actor.id,
        kind: "ACTIVITY",
        body: `Updated ${summary}.`,
      },
    });
  }

  revalidateTaskViews();
  return updated;
}

export async function addComment(taskId: string, body: string) {
  if (!body.trim()) return;
  const actor = await getCurrentUser();
  await prisma.comment.create({
    data: { taskId, authorId: actor.id, kind: "COMMENT", body: body.trim() },
  });
  revalidatePath("/");
}

export async function deleteTask(taskId: string) {
  await prisma.task.delete({ where: { id: taskId } });
  revalidateTaskViews();
}
