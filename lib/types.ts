import type { Prisma } from "@/generated/prisma/client";
import type { TASK_LIST_INCLUDE } from "@/lib/data/tasks";

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof TASK_LIST_INCLUDE }>;

export type PersonOption = { id: string; name: string };
export type ProjectOption = { id: string; name: string };
export type WorkstreamOption = { id: string; name: string };
