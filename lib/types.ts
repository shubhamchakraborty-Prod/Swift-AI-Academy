import type { Prisma } from "@/generated/prisma/client";
import type { TASK_LIST_INCLUDE } from "@/lib/data/tasks";
import type { PROJECT_LIST_INCLUDE } from "@/lib/data/projects";
import type { RESOURCE_LIST_INCLUDE } from "@/lib/data/resources";

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof TASK_LIST_INCLUDE }>;
export type ProjectWithRelations = Prisma.ProjectGetPayload<{ include: typeof PROJECT_LIST_INCLUDE }>;
export type ResourceWithRelations = Prisma.ResourceGetPayload<{ include: typeof RESOURCE_LIST_INCLUDE }>;

export type PersonOption = { id: string; name: string };
export type ProjectOption = { id: string; name: string };
export type WorkstreamOption = { id: string; name: string };
