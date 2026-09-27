"use client";

import { Database, RefreshCw, Server, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Hint } from "@/components/ui/tooltip";
import { HEALTH_COPY, useHealth } from "@/features/system/use-health";
import { formatRelative, formatUptime } from "@/lib/format";
import { cn } from "@/lib/utils";

function Row({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Server;
  label: string;
  value: ReactNode;
  tone: "success" | "danger" | "neutral";
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted" aria-hidden>
        <Icon className="size-4 text-muted-foreground" />
      </span>
      <p className="flex-1 text-sm">{label}</p>
      <p className="flex items-center gap-2 text-sm font-medium">
        <StatusDot tone={tone} />
        {value}
      </p>
    </div>
  );
}

export function HealthCard() {
  const { data, isPending, refetch, isFetching, dataUpdatedAt } = useHealth();
  const copy = data ? HEALTH_COPY[data.level] : null;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Sức khỏe hệ thống</CardTitle>
          <CardDescription>Tự động kiểm tra mỗi 30 giây qua /health/live và /health/ready.</CardDescription>
        </div>
        <Hint label="Kiểm tra ngay">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void refetch()}
            aria-label="Kiểm tra sức khỏe hệ thống ngay"
          >
            <RefreshCw className={cn(isFetching && "animate-spin")} aria-hidden />
          </Button>
        </Hint>
      </CardHeader>
      <CardContent className="pt-3">
        {isPending || !data || !copy ? (
          <div className="space-y-3" aria-hidden>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <div
              role="status"
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3",
                copy.tone === "success"
                  ? "bg-success-soft"
                  : copy.tone === "warning"
                    ? "bg-warning-soft"
                    : "bg-danger-soft",
              )}
            >
              <StatusDot tone={copy.tone} pulse={data.level === "operational"} className="size-2.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{copy.label}</p>
                <p className="text-xs text-muted-foreground">Cập nhật {formatRelative(dataUpdatedAt)}</p>
              </div>
            </div>
            <div className="mt-2 divide-y">
              <Row
                icon={Server}
                label="API (liveness)"
                tone={data.uptimeSeconds !== null ? "success" : "danger"}
                value={data.uptimeSeconds !== null ? `Chạy ${formatUptime(data.uptimeSeconds)}` : "Không phản hồi"}
              />
              <Row
                icon={Database}
                label="Database (readiness)"
                tone={data.database?.status === "up" ? "success" : "danger"}
                value={
                  data.database
                    ? `${data.database.status === "up" ? "Sẵn sàng" : "Gián đoạn"} · ${data.database.latencyMs} ms`
                    : "Không xác định"
                }
              />
              <Row icon={Timer} label="Độ trễ khứ hồi" tone="neutral" value={`${data.roundTripMs} ms`} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
