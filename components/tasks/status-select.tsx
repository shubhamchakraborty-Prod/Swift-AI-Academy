"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Picker } from "@/components/tasks/picker";
import { Badge } from "@/components/ui/badge";
import { updateTaskField } from "@/lib/actions/tasks";
import { STATUS_LABELS, STATUS_OPTIONS, STATUS_TONE } from "@/lib/labels";
import type { TaskStatus } from "@/generated/prisma/enums";

export function StatusSelect({ taskId, value }: { taskId: string; value: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const options = STATUS_OPTIONS.map((s) => ({ id: s, label: STATUS_LABELS[s] }));

  return (
    <Picker
      options={options}
      value={value}
      placeholder="Set status"
      onChange={(next) =>
        startTransition(async () => {
          await updateTaskField(taskId, { status: next as TaskStatus });
          router.refresh();
        })
      }
      renderTrigger={() => (
        <Badge tone={STATUS_TONE[value]} className={pending ? "opacity-50" : "cursor-pointer"}>
          {STATUS_LABELS[value]}
        </Badge>
      )}
    />
  );
}
