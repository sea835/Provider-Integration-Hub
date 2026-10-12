"use client";

import { StatusDot } from "@/components/ui/badge";
import { Hint } from "@/components/ui/tooltip";
import { HEALTH_COPY, useHealth } from "@/features/system/use-health";
import { cn } from "@/lib/utils";

const DOT_ON_DARK = {
  success: "[&>span]:bg-[#6fe35a]",
  warning: "[&>span]:bg-[#ffc861]",
  danger: "[&>span]:bg-[#ff8f9f]",
} as const;

export function HealthPill({ className }: { className?: string }) {
  const { data, isPending } = useHealth();

  if (isPending || !data) {
    return (
      <span className={cn("inline-flex h-9 items-center gap-2.5 text-xs text-hero-muted", className)}>
        <StatusDot tone="neutral" className="[&>span]:bg-white/60" />
        Đang kiểm tra...
      </span>
    );
  }

  const copy = HEALTH_COPY[data.level];
  const detail =
    data.database !== null
      ? `Database ${data.database.status === "up" ? "phản hồi" : "không phản hồi"} sau ${data.database.latencyMs} ms, API ${data.roundTripMs} ms`
      : "Không nhận được phản hồi từ máy chủ API";

  return (
    <Hint label={detail} side="top">
      <span
        role="status"
        tabIndex={0}
        className={cn(
          "inline-flex h-9 items-center gap-2.5 rounded-md text-xs font-medium text-hero-foreground outline-white",
          className,
        )}
      >
        <StatusDot tone={copy.tone} pulse={data.level === "operational"} className={DOT_ON_DARK[copy.tone]} />
        <span>{copy.label}</span>
      </span>
    </Hint>
  );
}
