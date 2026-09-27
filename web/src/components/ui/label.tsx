"use client";

import { Label as LabelPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] leading-none font-medium text-foreground select-none peer-disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
