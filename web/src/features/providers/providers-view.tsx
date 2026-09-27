"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, History, Loader2, PlugZap, Plus, RefreshCw, Search, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Hint } from "@/components/ui/tooltip";
import { Can } from "@/features/auth/session-provider";
import { POLICIES } from "@/lib/auth/policies";
import { formatNumber } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { IS_PROVIDER_MOCK } from "./config";
import { CATEGORY_META, STATUS_META } from "./constants";
import { CreateProviderDialog } from "./create-provider-dialog";
import { DataSourceBadge } from "./data-source-badge";
import { useProviders } from "./hooks";
import { ProviderCard } from "./provider-card";
import { providerRepository } from "./repository";
import { PROVIDER_CATEGORIES, PROVIDER_STATUSES } from "./types";
import { useSyncCompletionToasts } from "./use-provider-actions";

function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-soft" aria-hidden>
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-5 h-3.5 w-full" />
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
      <Skeleton className="mt-4 h-12 w-full" />
      <Skeleton className="mt-4 h-8 w-full" />
    </div>
  );
}

export function ProvidersView() {
  const queryClient = useQueryClient();
  const { data: providers, isPending, isError, error, refetch, isFetching } = useProviders();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const term = useDeferredValue(search.trim().toLowerCase());

  useSyncCompletionToasts(providers);

  const stats = useMemo(() => {
    const list = providers ?? [];
    return {
      total: list.length,
      active: list.filter((provider) => provider.status === "ACTIVE").length,
      error: list.filter((provider) => provider.status === "ERROR").length,
      running: list.filter((provider) => provider.lastSyncStatus === "RUNNING").length,
    };
  }, [providers]);

  const filtered = useMemo(
    () =>
      (providers ?? []).filter((provider) => {
        if (status !== "all" && provider.status !== status) return false;
        if (category !== "all" && provider.category !== category) return false;
        if (!term) return true;
        return [provider.name, provider.code, provider.baseUrl].some((value) => value.toLowerCase().includes(term));
      }),
    [providers, status, category, term],
  );

  const hasFilters = search !== "" || status !== "all" || category !== "all";
  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setCategory("all");
  };

  const resetDemo = async () => {
    if (!providerRepository.resetDemoData) return;
    setResetting(true);
    try {
      await providerRepository.resetDemoData();
      await queryClient.invalidateQueries({ queryKey: queryKeys.providers.all });
      toast.success("Đã khôi phục dữ liệu mô phỏng");
    } finally {
      setResetting(false);
      setResetOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhà cung cấp"
        eyebrow={<DataSourceBadge />}
        description="Quản lý thông tin kết nối, kiểm tra tình trạng tích hợp và kích hoạt đồng bộ dữ liệu."
        actions={
          <>
            {IS_PROVIDER_MOCK ? (
              <Hint label="Khôi phục dữ liệu mô phỏng ban đầu">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setResetOpen(true)}
                  aria-label="Khôi phục dữ liệu mô phỏng"
                >
                  <History aria-hidden />
                </Button>
              </Hint>
            ) : null}
            <Hint label="Tải lại">
              <Button
                variant="outline"
                size="icon"
                onClick={() => void refetch()}
                aria-label="Tải lại danh sách nhà cung cấp"
              >
                <RefreshCw className={cn(isFetching && "animate-spin")} aria-hidden />
              </Button>
            </Hint>
            <Can policy={POLICIES.providers.create}>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus aria-hidden />
                Thêm nhà cung cấp
              </Button>
            </Can>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatTile label="Tổng nhà cung cấp" value={formatNumber(stats.total)} icon={PlugZap} loading={isPending} />
        <StatTile
          label="Đang hoạt động"
          value={formatNumber(stats.active)}
          icon={CheckCircle2}
          tone="success"
          loading={isPending}
        />
        <StatTile
          label="Lỗi kết nối"
          value={formatNumber(stats.error)}
          icon={AlertTriangle}
          tone="danger"
          loading={isPending}
        />
        <StatTile
          label="Đang đồng bộ"
          value={formatNumber(stats.running)}
          icon={Loader2}
          tone="info"
          loading={isPending}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên, mã hoặc endpoint…"
            aria-label="Tìm nhà cung cấp"
            className="pl-9"
            autoComplete="off"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-44" aria-label="Lọc theo trạng thái">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi trạng thái</SelectItem>
              {PROVIDER_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {STATUS_META[value].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="sm:w-44" aria-label="Lọc theo nhóm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi nhóm</SelectItem>
              {PROVIDER_CATEGORIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {CATEGORY_META[value].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="self-start lg:self-auto">
            <X aria-hidden />
            Xóa bộ lọc
          </Button>
        ) : null}
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border bg-card">
          <ErrorState error={error} onRetry={() => void refetch()} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card">
          <EmptyState
            icon={PlugZap}
            title={hasFilters ? "Không có nhà cung cấp phù hợp" : "Chưa có nhà cung cấp nào"}
            description={
              hasFilters ? "Thử bỏ bớt điều kiện lọc." : "Thêm nhà cung cấp đầu tiên để bắt đầu tích hợp dữ liệu."
            }
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              ) : (
                <Can policy={POLICIES.providers.create}>
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus aria-hidden />
                    Thêm nhà cung cấp
                  </Button>
                </Can>
              )
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </div>
      )}

      <CreateProviderDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Khôi phục dữ liệu mô phỏng?"
        description="Mọi thay đổi trên dữ liệu nhà cung cấp mô phỏng trong trình duyệt này sẽ bị thay bằng bộ dữ liệu ban đầu."
        confirmLabel="Khôi phục"
        isPending={resetting}
        onConfirm={() => void resetDemo()}
      />
    </div>
  );
}
