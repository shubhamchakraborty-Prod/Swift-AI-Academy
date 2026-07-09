"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Picker } from "@/components/tasks/picker";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { updateTaskField } from "@/lib/actions/tasks";
import { initials } from "@/lib/labels";

export function OwnerSelect({
  taskId,
  value,
  people,
}: {
  taskId: string;
  value: string | null;
  people: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const owner = people.find((p) => p.id === value);

  return (
    <Picker
      options={people.map((p) => ({ id: p.id, label: p.name }))}
      value={value}
      placeholder="Unassigned"
      allowClear
      onChange={(next) =>
        startTransition(async () => {
          await updateTaskField(taskId, { ownerId: next || null });
          router.refresh();
        })
      }
      renderTrigger={() => (
        <span
          className={`flex items-center gap-2 rounded-lg px-1.5 py-1 text-[13px] text-ink hover:bg-surface-2 ${pending ? "opacity-50" : ""}`}
        >
          {owner ? (
            <Avatar>
              <AvatarFallback>{initials(owner.name)}</AvatarFallback>
            </Avatar>
          ) : (
            <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-border text-muted-2">
              +
            </span>
          )}
          {owner?.name ?? <span className="text-muted-2">Unassigned</span>}
        </span>
      )}
    />
  );
}
