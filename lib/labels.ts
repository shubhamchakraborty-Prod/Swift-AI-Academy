import { Priority, TaskStatus, PipelineStage, ResourceType } from "@/generated/prisma/enums";

export const STATUS_LABELS: Record<string, string> = {
  [TaskStatus.NOT_STARTED]: "Not started",
  [TaskStatus.IN_PROGRESS]: "In progress",
  [TaskStatus.WAITING_FOR_APPROVAL]: "Waiting for approval",
  [TaskStatus.BLOCKED]: "Blocked",
  [TaskStatus.ON_HOLD]: "On hold",
  [TaskStatus.COMPLETED]: "Completed",
  [TaskStatus.SCRAPPED]: "Scrapped",
};

export const STATUS_TONE: Record<string, "neutral" | "primary" | "warning" | "danger" | "success"> = {
  [TaskStatus.NOT_STARTED]: "neutral",
  [TaskStatus.IN_PROGRESS]: "primary",
  [TaskStatus.WAITING_FOR_APPROVAL]: "warning",
  [TaskStatus.BLOCKED]: "danger",
  [TaskStatus.ON_HOLD]: "neutral",
  [TaskStatus.COMPLETED]: "success",
  [TaskStatus.SCRAPPED]: "neutral",
};

export const PRIORITY_LABELS: Record<string, string> = {
  [Priority.NOT_PRIORITISED]: "Not prioritised",
  [Priority.LOW]: "Low",
  [Priority.MEDIUM]: "Medium",
  [Priority.HIGH]: "High",
  [Priority.URGENT]: "Urgent",
  [Priority.CRITICAL]: "Critical",
};

export const PRIORITY_TONE: Record<string, "neutral" | "primary" | "warning" | "danger" | "success"> = {
  [Priority.NOT_PRIORITISED]: "neutral",
  [Priority.LOW]: "success",
  [Priority.MEDIUM]: "primary",
  [Priority.HIGH]: "warning",
  [Priority.URGENT]: "danger",
  [Priority.CRITICAL]: "danger",
};

export const STATUS_OPTIONS = Object.values(TaskStatus);
export const PRIORITY_OPTIONS = Object.values(Priority);

export const PIPELINE_STAGE_LABELS: Record<string, string> = {
  [PipelineStage.EOI_RECEIVED]: "EOI received",
  [PipelineStage.PROPOSAL_DRAFTED]: "Proposal drafted",
  [PipelineStage.SHARED_WITH_STAKEHOLDER]: "Shared with stakeholder",
  [PipelineStage.ACCEPTED]: "Accepted",
  [PipelineStage.CONVERTED]: "Converted",
};

export const PIPELINE_STAGE_TONE: Record<string, "neutral" | "primary" | "warning" | "danger" | "success"> = {
  [PipelineStage.EOI_RECEIVED]: "neutral",
  [PipelineStage.PROPOSAL_DRAFTED]: "primary",
  [PipelineStage.SHARED_WITH_STAKEHOLDER]: "warning",
  [PipelineStage.ACCEPTED]: "success",
  [PipelineStage.CONVERTED]: "success",
};

export const PIPELINE_STAGE_OPTIONS = [
  PipelineStage.EOI_RECEIVED,
  PipelineStage.PROPOSAL_DRAFTED,
  PipelineStage.SHARED_WITH_STAKEHOLDER,
  PipelineStage.ACCEPTED,
];

export const INSTITUTE_TYPES = ["Schools", "Colleges", "ITI", "Polytechnic", "Others"];

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  [ResourceType.CONCEPT_NOTE]: "Concept note",
  [ResourceType.CLAUDE_SKILL]: "Claude skill",
  [ResourceType.PROPOSAL_DOC]: "Proposal doc",
  [ResourceType.RFP_DRAFT]: "RFP draft",
  [ResourceType.PRESENTATION_DECK]: "Presentation deck",
  [ResourceType.WEBSITE_PLATFORM]: "Website / platform",
  [ResourceType.DEMO_PROTOTYPE]: "Demo / prototype",
  [ResourceType.CUSTOM_GPT]: "Custom GPT",
  [ResourceType.OTHER]: "Other",
};

export const RESOURCE_TYPE_OPTIONS = Object.values(ResourceType);

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
