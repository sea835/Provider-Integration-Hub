import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div aria-hidden className={cn("skeleton-shimmer animate-shimmer rounded-sm bg-muted", className)} {...props} />
  );
}
