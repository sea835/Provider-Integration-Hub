"use client";

import { Check, Minus } from "@phosphor-icons/react/ssr";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer group relative inline-flex size-4 shrink-0 items-center justify-center rounded-sm bg-card shadow-[inset_0_0_0_1.5px_var(--color-input)] transition-[background-color,box-shadow] duration-150 after:absolute after:-inset-2.5 after:content-[''] hover:shadow-[inset_0_0_0_1.5px_var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:shadow-xs data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:shadow-xs",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        <Check className="size-3 group-data-[state=indeterminate]:hidden" weight="bold" aria-hidden />
        <Minus className="hidden size-3 group-data-[state=indeterminate]:block" weight="bold" aria-hidden />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
