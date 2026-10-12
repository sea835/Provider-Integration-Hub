"use client";

import { CheckCircle, Database, HardDrives, Timer, Warning, WifiSlash } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HEALTH_COPY, useHealth, type HealthLevel } from "@/features/system/use-health";
import { formatRelative, formatUptime } from "@/lib/format";
import { cn } from "@/lib/utils";

const LEVEL_ICON: Record<HealthLevel, { icon: typeof CheckCircle; className: string }> = {
  operational: { icon: CheckCircle, className: "bg-success-soft text-success" },
  degraded: { icon: Warning, className: "bg-warning-soft text-warning" },
  offline: { icon: WifiSlash, className: "bg-danger-soft text-danger" },
};

function Row({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof HardDrives;
  label: string;
  value: ReactNode;
  tone: "success" | "danger" | "neutral";
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="flex-1 text-[13px] text-muted-foreground">{label}</p>
      <p className="flex items-center gap-2 text-[13px] font-medium">
        <StatusDot tone={tone} />
        {value}
      </p>
    </div>
  );
}

export function HealthCard({ className }: { className?: string }) {
  const { data, isPending, refetch, isFetching, dataUpdatedAt } = useHealth();
  const copy = data ? HEALTH_COPY[data.level] : null;
  const level = data ? LEVEL_ICON[data.level] : null;

  return (
    <Card className={cn("flex flex-col p-4 sm:p-5", className)}>
      <CardTitle>Sức khỏe hệ thống</CardTitle>
      <CardDescription>Tự động kiểm tra mỗi 30 giây</CardDescription>

      {isPending || !data || !copy || !level ? (
        <div className="mt-5 flex-1 space-y-3" aria-hidden>
          <Skeleton className="mx-auto size-14 rounded-full" />
          <Skeleton className="mx-auto h-5 w-40" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div className="mt-4 flex-1">
          <div role="status" className="flex flex-col items-center text-center">
            <span className={cn("flex size-14 items-center justify-center rounded-full", level.className)} aria-hidden>
              <level.icon className="size-7" weight="fill" />
            </span>
            <p className="mt-3 text-lg leading-tight font-bold">{copy.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">Cập nhật {formatRelative(dataUpdatedAt)}</p>
          </div>
          <div className="mt-4">
            <Row
              icon={HardDrives}
              label="API"
              tone={data.uptimeSeconds !== null ? "success" : "danger"}
              value={data.uptimeSeconds !== null ? `Chạy ${formatUptime(data.uptimeSeconds)}` : "Không phản hồi"}
            />
            <Row
              icon={Database}
              label="Database"
              tone={data.database?.status === "up" ? "success" : "danger"}
              value={
                data.database
                  ? `${data.database.status === "up" ? "Sẵn sàng" : "Gián đoạn"} · ${data.database.latencyMs} ms`
                  : "Không xác định"
              }
            />
            <Row icon={Timer} label="Độ trễ" tone="neutral" value={`${data.roundTripMs} ms`} />
          </div>
        </div>
      )}

      <Button size="lg" className="mt-4 w-full" isLoading={isFetching} onClick={() => void refetch()}>
        Kiểm tra ngay
      </Button>
    </Card>
  );
}
