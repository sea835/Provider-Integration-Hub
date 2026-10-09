"use client";

import { StatusDot } from "@/components/ui/badge";
import { Hint } from "@/components/ui/tooltip";
import { HEALTH_COPY, useHealth } from "@/features/system/use-health";
import { cn } from "@/lib/utils";

export function HealthPill({ className }: { className?: string }) {
  const { data, isPending } = useHealth();

  if (isPending || !data) {
    return (
      <span className={cn("inline-flex h-8 items-center gap-2 text-xs text-muted-foreground", className)}>
        <StatusDot tone="neutral" />
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
    <Hint label={detail} side="bottom">
      <span
        role="status"
        tabIndex={0}
        className={cn("inline-flex h-8 items-center gap-2 rounded-md text-xs text-muted-foreground", className)}
      >
        <StatusDot tone={copy.tone} pulse={data.level === "operational"} />
        <span>{copy.label}</span>
      </span>
    </Hint>
  );
}
