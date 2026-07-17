import { prisma } from "@/lib/prisma";

export async function listPeople() {
  return prisma.person.findMany({ orderBy: { name: "asc" } });
}

export async function listWorkstreams() {
  return prisma.workstream.findMany({ orderBy: { name: "asc" } });
}
