import { prisma } from "@/lib/prisma";

export const RESOURCE_LIST_INCLUDE = {
  project: { select: { id: true, name: true } },
  task: { select: { id: true, title: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

export async function listResources() {
  return prisma.resource.findMany({
    include: RESOURCE_LIST_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}
