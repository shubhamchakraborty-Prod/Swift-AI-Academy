"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addComment } from "@/lib/actions/tasks";

export function AddCommentForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        const body = String(formData.get("body") ?? "");
        startTransition(async () => {
          await addComment(taskId, body);
          formRef.current?.reset();
          router.refresh();
        });
      }}
      className="flex items-end gap-2"
    >
      <textarea
        name="body"
        rows={2}
        placeholder="Leave a comment..."
        className="flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted-2 focus:border-primary"
      />
      <Button type="submit" size="icon" disabled={pending} aria-label="Send comment">
        <Send />
      </Button>
    </form>
  );
}
