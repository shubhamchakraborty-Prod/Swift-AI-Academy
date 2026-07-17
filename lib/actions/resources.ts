"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import type { ResourceType } from "@/generated/prisma/enums";

export async function createResource(input: {
  title: string;
  type: ResourceType;
  url: string;
  projectId?: string | null;
}) {
  if (!input.title.trim() || !input.url.trim()) {
    throw new Error("Title and link are required.");
  }
  const actor = await getCurrentUser();

  const resource = await prisma.resource.create({
    data: {
      title: input.title.trim(),
      type: input.type,
      url: input.url.trim(),
      projectId: input.projectId || null,
      createdById: actor.id,
    },
  });

  revalidatePath("/gallery");
  return resource;
}

export async function deleteResource(id: string) {
  await prisma.resource.delete({ where: { id } });
  revalidatePath("/gallery");
}
