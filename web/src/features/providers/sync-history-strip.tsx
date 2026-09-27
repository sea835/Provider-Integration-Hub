"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Hint } from "@/components/ui/tooltip";
import { formatDateTime, formatDuration, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProviderLog } from "./types";

const MAX_BARS = 30;

const BAR_TONE = {
  SUCCESS: "bg-chart-success",
  FAILED: "bg-chart-danger",
  RUNNING: "bg-chart-info",
} as const;

export function SyncHistoryStrip({ logs }: { logs: ProviderLog[] }) {
  const syncs = logs
    .filter((log) => log.type === "SYNC")
    .slice(0, MAX_BARS)
    .reverse();
  const succeeded = syncs.filter((log) => log.status === "SUCCESS").length;
  const failed = syncs.filter((log) => log.status === "FAILED").length;

  if (syncs.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có lần đồng bộ nào để hiển thị.</p>;
  }

  return (
    <figure className="space-y-3">
      <div
        className="flex h-9 items-end gap-0.5"
        role="list"
        aria-label={`${syncs.length} lần đồng bộ gần nhất, cũ nhất bên trái`}
      >
        {syncs.map((log) => {
          const label = `${formatDateTime(log.createdAt)} · ${
            log.status === "SUCCESS" ? "Thành công" : log.status === "FAILED" ? "Thất bại" : "Đang chạy"
          }${log.recordsProcessed !== null ? ` · ${formatNumber(log.recordsProcessed)} bản ghi` : ""}${
            log.durationMs !== null ? ` · ${formatDuration(log.durationMs)}` : ""
          }`;
          return (
            <Hint key={log.id} label={label}>
              <span
                role="listitem"
                aria-label={label}
                className={cn(
                  "h-full max-w-6 flex-1 rounded-t-[4px] transition-[filter,transform] hover:-translate-y-px hover:brightness-110",
                  BAR_TONE[log.status],
                  log.status === "RUNNING" && "animate-pulse",
                )}
              />
            </Hint>
          );
        })}
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-chart-success" aria-hidden />
          <CheckCircle2 className="size-3.5 text-success" aria-hidden />
          Thành công <span className="font-medium text-foreground tabular-nums">{succeeded}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-chart-danger" aria-hidden />
          <XCircle className="size-3.5 text-danger" aria-hidden />
          Thất bại <span className="font-medium text-foreground tabular-nums">{failed}</span>
        </span>
        <span className="ml-auto">Cũ hơn ← → Mới nhất</span>
      </figcaption>
    </figure>
  );
}
