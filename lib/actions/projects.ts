"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { PipelineStage } from "@/generated/prisma/enums";

function revalidateProjectViews() {
  revalidatePath("/pipeline");
  revalidatePath("/gallery");
  revalidatePath("/");
}

export async function createProject(input: {
  name: string;
  description?: string | null;
  instituteTypes: string[];
  ownerId?: string | null;
}) {
  if (!input.name.trim()) {
    throw new Error("Project name is required.");
  }

  const project = await prisma.project.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      instituteTypes: input.instituteTypes,
      ownerId: input.ownerId || null,
      pipelineStage: "EOI_RECEIVED",
    },
  });

  revalidateProjectViews();
  return project;
}

export async function updateProjectStage(projectId: string, pipelineStage: PipelineStage) {
  const project = await prisma.project.update({
    where: { id: projectId },
    data: { pipelineStage },
  });
  revalidateProjectViews();
  return project;
}

export async function convertProject(projectId: string) {
  const project = await prisma.project.update({
    where: { id: projectId },
    data: { pipelineStage: null, convertedAt: new Date() },
  });
  revalidateProjectViews();
  return project;
}
