import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const inputClassName =
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-xs transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60 read-only:cursor-default read-only:bg-muted/60 read-only:text-muted-foreground aria-invalid:border-danger aria-invalid:ring-danger/15 pointer-coarse:h-11 pointer-coarse:text-base";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input type={type} className={cn(inputClassName, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputClassName, "h-auto min-h-20 py-2 leading-relaxed", className)} {...props} />;
}
