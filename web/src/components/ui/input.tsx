import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const inputClassName =
  "flex h-9 w-full min-w-0 rounded-md bg-field px-3 text-sm text-foreground transition-[background-color,box-shadow] duration-200 placeholder:text-muted-foreground hover:bg-muted focus-visible:bg-card focus-visible:shadow-xs focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 read-only:cursor-default read-only:bg-muted read-only:text-muted-foreground aria-invalid:bg-danger-soft aria-invalid:ring-2 aria-invalid:ring-danger/40 pointer-coarse:h-11 pointer-coarse:text-base";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input type={type} className={cn(inputClassName, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputClassName, "h-auto min-h-20 py-2 leading-relaxed", className)} {...props} />;
}
