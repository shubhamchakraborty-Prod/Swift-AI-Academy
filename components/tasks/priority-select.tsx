"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Picker } from "@/components/tasks/picker";
import { Badge } from "@/components/ui/badge";
import { updateTaskField } from "@/lib/actions/tasks";
import { PRIORITY_LABELS, PRIORITY_OPTIONS, PRIORITY_TONE } from "@/lib/labels";
import type { Priority } from "@/generated/prisma/enums";

export function PrioritySelect({ taskId, value }: { taskId: string; value: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const options = PRIORITY_OPTIONS.map((p) => ({ id: p, label: PRIORITY_LABELS[p] }));

  return (
    <Picker
      options={options}
      value={value}
      placeholder="Set priority"
      onChange={(next) =>
        startTransition(async () => {
          await updateTaskField(taskId, { priority: next as Priority });
          router.refresh();
        })
      }
      renderTrigger={() => (
        <Badge tone={PRIORITY_TONE[value]} className={pending ? "opacity-50" : "cursor-pointer"}>
          {PRIORITY_LABELS[value]}
        </Badge>
      )}
    />
  );
}
