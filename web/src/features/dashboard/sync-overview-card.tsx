"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, Loader2, XCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Hint } from "@/components/ui/tooltip";
import { DataSourceBadge } from "@/features/providers/data-source-badge";
import { ProviderIcon } from "@/features/providers/provider-visuals";
import type { Provider, SyncStatus } from "@/features/providers/types";
import { cn } from "@/lib/utils";

const SEGMENTS: Array<{ status: SyncStatus; label: string; fill: string; icon: LucideIcon; iconClass: string }> = [
  { status: "SUCCESS", label: "Thành công", fill: "bg-chart-success", icon: CheckCircle2, iconClass: "text-success" },
  { status: "RUNNING", label: "Đang đồng bộ", fill: "bg-chart-info", icon: Loader2, iconClass: "text-info" },
  { status: "FAILED", label: "Thất bại", fill: "bg-chart-danger", icon: XCircle, iconClass: "text-danger" },
  {
    status: "NEVER",
    label: "Chưa đồng bộ",
    fill: "bg-chart-track",
    icon: CircleDashed,
    iconClass: "text-muted-foreground",
  },
];

interface SyncOverviewCardProps {
  providers: Provider[] | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
}

export function SyncOverviewCard({ providers, isPending, error, onRetry }: SyncOverviewCardProps) {
  const list = providers ?? [];
  const total = list.length;
  const counts = SEGMENTS.map((segment) => ({
    ...segment,
    count: list.filter((provider) => provider.lastSyncStatus === segment.status).length,
  }));
  const attention = list
    .filter((provider) => provider.status === "ERROR" || provider.lastSyncStatus === "FAILED")
    .slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            Trạng thái đồng bộ
            <DataSourceBadge />
          </CardTitle>
          <CardDescription>Kết quả đồng bộ gần nhất của từng nhà cung cấp.</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/providers">
            Xem tất cả
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {isPending ? (
          <div className="space-y-3" aria-hidden>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={onRetry} className="py-6" />
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có nhà cung cấp nào được cấu hình.</p>
        ) : (
          <>
            <figure className="space-y-3">
              <div
                className="flex h-3 w-full gap-0.5 overflow-hidden rounded-[4px]"
                role="img"
                aria-label={counts.map((item) => `${item.label}: ${item.count}`).join(", ")}
              >
                {counts
                  .filter((item) => item.count > 0)
                  .map((item) => (
                    <Hint key={item.status} label={`${item.label}: ${item.count} / ${total} nhà cung cấp`}>
                      <span
                        className={cn("h-full transition-[filter] hover:brightness-110", item.fill)}
                        style={{ width: `${(item.count / total) * 100}%` }}
                      />
                    </Hint>
                  ))}
              </div>
              <figcaption>
                <ul className="flex flex-wrap gap-x-5 gap-y-2">
                  {counts.map(({ status, label, fill, icon: Icon, iconClass, count }) => (
                    <li key={status} className="flex items-center gap-1.5 text-[13px] whitespace-nowrap">
                      <span className={cn("size-2.5 shrink-0 rounded-[3px]", fill)} aria-hidden />
                      <Icon
                        className={cn(
                          "size-3.5 shrink-0",
                          iconClass,
                          status === "RUNNING" && count > 0 && "animate-spin",
                        )}
                        aria-hidden
                      />
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold tabular-nums">{count}</span>
                    </li>
                  ))}
                </ul>
              </figcaption>
            </figure>

            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <AlertTriangle className="size-3.5" aria-hidden />
                Cần chú ý
              </p>
              {attention.length === 0 ? (
                <p className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2.5 text-[13px] text-success">
                  <CheckCircle2 className="size-4" aria-hidden />
                  Mọi tích hợp đang hoạt động bình thường.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {attention.map((provider) => (
                    <li key={provider.id}>
                      <Link
                        href={`/providers/${provider.id}`}
                        className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-subtle"
                      >
                        <ProviderIcon category={provider.category} status={provider.status} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{provider.name}</span>
                          <span className="block truncate text-xs text-danger">
                            {provider.lastSyncMessage ?? "Lỗi kết nối"}
                          </span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
