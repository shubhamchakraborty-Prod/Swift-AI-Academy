"use client";

import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface PickerOption {
  id: string;
  label: string;
}

interface PickerProps {
  options: PickerOption[];
  value: string | null | undefined;
  placeholder: string;
  onChange: (id: string) => void;
  renderTrigger?: (selected: PickerOption | undefined) => ReactNode;
  triggerClassName?: string;
  allowClear?: boolean;
}

export function Picker({
  options,
  value,
  placeholder,
  onChange,
  renderTrigger,
  triggerClassName,
  allowClear,
}: PickerProps) {
  const selected = options.find((o) => o.id === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {renderTrigger ? (
          <button type="button">{renderTrigger(selected)}</button>
        ) : (
          <button
            type="button"
            className={cn(
              "flex h-9 w-full items-center justify-between rounded-lg border border-border bg-surface px-3 text-left text-sm text-ink transition-colors hover:bg-surface-2",
              !selected && "text-muted-2",
              triggerClassName
            )}
          >
            {selected?.label ?? placeholder}
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
        {allowClear && (
          <DropdownMenuItem onClick={() => onChange("")} className="text-muted">
            {placeholder}
          </DropdownMenuItem>
        )}
        {options.map((option) => (
          <DropdownMenuItem key={option.id} onClick={() => onChange(option.id)}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
