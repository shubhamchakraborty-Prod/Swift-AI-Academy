import { prisma } from "@/lib/prisma";

export async function listProjects() {
  return prisma.project.findMany({ orderBy: { name: "asc" } });
}
