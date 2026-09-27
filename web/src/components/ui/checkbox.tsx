"use client";

import { Check, Minus } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer group relative inline-flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border border-input bg-card shadow-xs transition-[background-color,border-color,box-shadow] after:absolute after:-inset-2.5 after:content-[''] hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        <Check className="size-3.5 group-data-[state=indeterminate]:hidden" strokeWidth={3} aria-hidden />
        <Minus className="hidden size-3.5 group-data-[state=indeterminate]:block" strokeWidth={3} aria-hidden />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
