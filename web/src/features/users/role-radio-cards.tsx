"use client";

import { RadioGroup } from "radix-ui";
import type { SystemRole } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { ROLE_OPTIONS } from "./constants";

interface RoleRadioCardsProps {
  value: SystemRole;
  onChange: (role: SystemRole) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export function RoleRadioCards({ value, onChange, disabled, ariaLabel = "Vai trò" }: RoleRadioCardsProps) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(next) => onChange(next as SystemRole)}
      disabled={disabled}
      aria-label={ariaLabel}
      className="grid gap-2"
    >
      {ROLE_OPTIONS.map((option) => (
        <RadioGroup.Item
          key={option.value}
          value={option.value}
          className={cn(
            "group flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left transition-[border-color,background-color,box-shadow] hover:border-primary/40 disabled:opacity-60 data-[state=checked]:border-primary data-[state=checked]:bg-primary-soft/60 data-[state=checked]:shadow-[0_0_0_3px_var(--primary-soft)]",
          )}
        >
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-card group-data-[state=checked]:border-primary">
            <RadioGroup.Indicator className="size-2 rounded-full bg-primary" />
          </span>
          <span className="min-w-0 space-y-0.5">
            <span className="flex items-center gap-2 text-sm font-medium">
              {option.label}
              <span className="font-mono text-[11px] font-normal text-muted-foreground">{option.value}</span>
            </span>
            <span className="block text-[13px] leading-snug text-muted-foreground">{option.description}</span>
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
