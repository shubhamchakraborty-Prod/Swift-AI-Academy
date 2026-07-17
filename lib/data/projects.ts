import { prisma } from "@/lib/prisma";

export const PROJECT_LIST_INCLUDE = {
  owner: { select: { id: true, name: true } },
  _count: { select: { tasks: true, resources: true } },
} as const;

export async function listProjects() {
  return prisma.project.findMany({ orderBy: { name: "asc" } });
}

export async function listPipelineProjects() {
  return prisma.project.findMany({
    where: { pipelineStage: { not: null } },
    include: PROJECT_LIST_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });
}

export async function listConvertedProjects() {
  return prisma.project.findMany({
    where: { pipelineStage: null },
    include: PROJECT_LIST_INCLUDE,
    orderBy: { name: "asc" },
  });
}
