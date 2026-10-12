"use client";

import { ArrowClockwise, ClockCounterClockwise } from "@phosphor-icons/react/ssr";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ChecksTable } from "@/features/providers/checks-table";
import { useHistory, useProviders } from "@/features/providers/hooks";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;
const DAY_MS = 86_400_000;

const PERIODS = [
  { value: "1", label: "24 giờ qua" },
  { value: "7", label: "7 ngày qua" },
  { value: "30", label: "30 ngày qua" },
  { value: "90", label: "90 ngày qua" },
];

const STATUSES = [
  { value: "all", label: "Mọi kết quả" },
  { value: "SUCCESS", label: "Thành công" },
  { value: "FAILED", label: "Thất bại" },
];

function startOf(days: string): string {
  const now = new Date();
  now.setSeconds(0, 0);
  return new Date(now.getTime() - Number(days) * DAY_MS).toISOString();
}

export function HistoryView() {
  const searchParams = useSearchParams();
  const providers = useProviders();
  const [providerId, setProviderId] = useState(() => searchParams.get("providerId") ?? "all");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("7");
  const [from, setFrom] = useState(() => startOf("7"));
  const [page, setPage] = useState(1);

  const history = useHistory({
    providerId: providerId === "all" ? undefined : providerId,
    status: status === "all" ? undefined : status,
    from,
    page,
    limit: PAGE_SIZE,
  });
  const names = new Map((providers.data ?? []).map((provider) => [provider.id, provider.name]));
  const meta = history.data?.meta;

  const reload = () => {
    setFrom(startOf(period));
    void history.refetch();
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Giám sát số dư"
        title="Lịch sử kiểm tra"
        description="Mọi lần kiểm tra số dư, thành công hay lỗi, được giữ trong 90 ngày."
        actions={
          <Button variant="inverse-ghost" size="sm" onClick={reload}>
            <ArrowClockwise className={cn(history.isFetching && "animate-spin")} aria-hidden />
            Tải lại
          </Button>
        }
      />

      <Card className="p-4">
        <div className="grid gap-2 pb-3 sm:grid-cols-3 lg:flex">
          <Select
            value={providerId}
            onValueChange={(value) => {
              setProviderId(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="lg:w-64" aria-label="Lọc theo đối tác">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi đối tác</SelectItem>
              {(providers.data ?? []).map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="lg:w-44" aria-label="Lọc theo kết quả">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={period}
            onValueChange={(value) => {
              setPeriod(value);
              setFrom(startOf(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="lg:w-44" aria-label="Khoảng thời gian">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {history.isPending ? (
          <div className="space-y-2" aria-hidden>
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : history.isError ? (
          <ErrorState error={history.error} onRetry={() => void history.refetch()} />
        ) : history.data.data.length === 0 ? (
          <EmptyState
            icon={ClockCounterClockwise}
            title="Không có lần kiểm tra nào"
            description="Thử đổi bộ lọc hoặc khoảng thời gian."
          />
        ) : (
          <div className={cn("transition-opacity", history.isPlaceholderData && "opacity-60")}>
            <ChecksTable checks={history.data.data} providerName={(id) => names.get(id) ?? "Đối tác đã xóa"} />
          </div>
        )}

        {meta && meta.total > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 pt-3 text-[13px] text-muted-foreground sm:flex-row">
            <p className="tabular-nums" aria-live="polite">
              Hiển thị {formatNumber((meta.page - 1) * meta.limit + 1)}-
              {formatNumber(Math.min(meta.page * meta.limit, meta.total))} trên {formatNumber(meta.total)} lần kiểm tra
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!meta.hasPrevPage}
                onClick={() => setPage((current) => current - 1)}
              >
                Trước
              </Button>
              <span className="min-w-16 text-center tabular-nums">
                {meta.page} / {meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!meta.hasNextPage}
                onClick={() => setPage((current) => current + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
