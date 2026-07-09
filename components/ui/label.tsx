import * as React from "react";
import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "font-mono text-[10.5px] uppercase tracking-wide text-muted-2",
        className
      )}
      {...props}
    />
  );
}

export { Label };
