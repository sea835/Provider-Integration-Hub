"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, CirclePause, CircleSlash, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Hint } from "@/components/ui/tooltip";
import { SupplierStatusBadge } from "@/features/suppliers/supplier-visuals";
import type { Supplier, SupplierStatus } from "@/features/suppliers/types";
import { cn } from "@/lib/utils";

const SEGMENTS: Array<{ status: SupplierStatus; label: string; fill: string; icon: LucideIcon; iconClass: string }> = [
  { status: "ACTIVE", label: "Đang chạy", fill: "bg-chart-success", icon: CheckCircle2, iconClass: "text-success" },
  { status: "PAUSED", label: "Tạm dừng", fill: "bg-warning", icon: CirclePause, iconClass: "text-warning" },
  {
    status: "DISABLED",
    label: "Ngừng hẳn",
    fill: "bg-chart-track",
    icon: CircleSlash,
    iconClass: "text-muted-foreground",
  },
];

interface SupplierOverviewCardProps {
  suppliers: Supplier[] | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
}

export function SupplierOverviewCard({ suppliers, isPending, error, onRetry }: SupplierOverviewCardProps) {
  const list = suppliers ?? [];
  const total = list.length;
  const counts = SEGMENTS.map((segment) => ({
    ...segment,
    count: list.filter((supplier) => supplier.status === segment.status).length,
  }));
  const paused = list.filter((supplier) => supplier.status === "PAUSED").slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Nhà cung cấp</CardTitle>
          <CardDescription>Nhà cung cấp nào đang nhận đơn, nhà cung cấp nào đang tạm dừng.</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/suppliers">
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
          <p className="text-sm text-muted-foreground">Chưa có nhà cung cấp nào. Vào trang Nhà cung cấp để thêm.</p>
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
                      <Icon className={cn("size-3.5 shrink-0", iconClass)} aria-hidden />
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
                Đang tạm dừng
              </p>
              {paused.length === 0 ? (
                <p className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2.5 text-[13px] text-success">
                  <CheckCircle2 className="size-4" aria-hidden />
                  Không có nhà cung cấp nào đang tạm dừng.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {paused.map((supplier) => (
                    <li key={supplier.id}>
                      <Link
                        href={`/suppliers/${supplier.id}`}
                        className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-subtle"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{supplier.name}</span>
                          <span className="block truncate font-mono text-xs text-muted-foreground">
                            {supplier.code}
                          </span>
                        </span>
                        <SupplierStatusBadge status={supplier.status} />
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
