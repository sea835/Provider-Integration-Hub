"use client";

import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Gauge,
  MoreHorizontal,
  PlugZap,
  RefreshCw,
  Settings2,
  Timer,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hint } from "@/components/ui/tooltip";
import { Can, usePermission } from "@/features/auth/session-provider";
import { isApiError } from "@/lib/api/errors";
import { POLICIES } from "@/lib/auth/policies";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AUTH_TYPE_META, CATEGORY_META, LOG_TYPE_META, SYNC_STATUS_META, syncIntervalLabel } from "./constants";
import { DataSourceBadge } from "./data-source-badge";
import { useDeleteProvider, useProvider, useProviderLogs, useUpdateProvider } from "./hooks";
import { ProviderForm, toProviderInput } from "./provider-form";
import { ProviderLogs } from "./provider-logs";
import { LogStatusBadge, ProviderIcon, ProviderStatusBadge, SyncSummary } from "./provider-visuals";
import { SyncHistoryStrip } from "./sync-history-strip";
import type { Provider, ProviderLog } from "./types";
import { useProviderActions, useSyncCompletionToasts } from "./use-provider-actions";

const TABS = ["overview", "settings", "logs"] as const;
type TabValue = (typeof TABS)[number];

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

function ConnectionCard({
  provider,
  onTest,
  isTesting,
}: {
  provider: Provider;
  onTest: () => void;
  isTesting: boolean;
}) {
  const checked = provider.lastConnectionCheckAt;
  const healthy = provider.status !== "ERROR" && provider.lastLatencyMs !== null;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Kết nối</CardTitle>
          <CardDescription>Kết quả kiểm tra gần nhất tới endpoint của nhà cung cấp.</CardDescription>
        </div>
        <Can policy={POLICIES.providers.test}>
          <Button variant="outline" size="sm" onClick={onTest} isLoading={isTesting}>
            {isTesting ? null : <PlugZap aria-hidden />}
            Kiểm tra
          </Button>
        </Can>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg p-3.5",
            healthy ? "bg-success-soft" : checked ? "bg-danger-soft" : "bg-muted",
          )}
        >
          {healthy ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          ) : checked ? (
            <XCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          ) : (
            <PlugZap className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <div className="min-w-0 text-sm">
            <p className="font-medium">
              {healthy ? "Kết nối ổn định" : checked ? "Kết nối gặp sự cố" : "Chưa kiểm tra kết nối"}
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {checked ? (
                <>
                  Kiểm tra{" "}
                  <time dateTime={checked} title={formatDateTime(checked)}>
                    {formatRelative(checked)}
                  </time>
                  {provider.lastLatencyMs !== null ? ` · phản hồi ${provider.lastLatencyMs} ms` : ""}
                </>
              ) : (
                "Hãy chạy kiểm tra để xác nhận thông tin xác thực và endpoint."
              )}
            </p>
          </div>
        </div>
        <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Endpoint</dt>
            <dd className="truncate font-mono text-[12.5px]" title={provider.baseUrl}>
              {provider.baseUrl}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Xác thực</dt>
            <dd>{AUTH_TYPE_META[provider.authType].label}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Timeout</dt>
            <dd>{Math.round(provider.timeoutMs / 1000)} giây</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function RecentActivity({ logs, onViewAll }: { logs: ProviderLog[]; onViewAll: () => void }) {
  const items = logs.slice(0, 6);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Hoạt động gần đây</CardTitle>
          <CardDescription>Đồng bộ, kiểm tra kết nối và thay đổi cấu hình.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onViewAll}>
          Xem tất cả
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có hoạt động nào.</p>
        ) : (
          <ol className="relative space-y-4 before:absolute before:inset-y-1 before:left-[5px] before:w-px before:bg-border">
            {items.map((log) => (
              <li key={log.id} className="relative flex gap-3 pl-5">
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1.5 left-0 size-[11px] rounded-full border-2 border-card",
                    log.status === "SUCCESS" ? "bg-success" : log.status === "FAILED" ? "bg-danger" : "bg-info",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{LOG_TYPE_META[log.type].label}</span>
                    <LogStatusBadge status={log.status} />
                  </div>
                  <p className="mt-0.5 truncate text-[13px] text-muted-foreground" title={log.message}>
                    {log.message}
                  </p>
                </div>
                <time
                  dateTime={log.createdAt}
                  title={formatDateTime(log.createdAt)}
                  className="shrink-0 text-xs text-muted-foreground"
                >
                  {formatRelative(log.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export function ProviderDetailView({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const providerQuery = useProvider(id);
  const logsQuery = useProviderLogs(id);
  const updateProvider = useUpdateProvider(id);
  const deleteProvider = useDeleteProvider();
  const canUpdate = usePermission(POLICIES.providers.update);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const provider = providerQuery.data;
  const tracked = useMemo(() => (provider ? [provider] : undefined), [provider]);
  useSyncCompletionToasts(tracked);

  const actions = useProviderActions(provider ?? { id, name: "", status: "ACTIVE", lastSyncStatus: "NEVER" });

  const requestedTab = searchParams.get("tab");
  const tab: TabValue = TABS.includes(requestedTab as TabValue) ? (requestedTab as TabValue) : "overview";
  const setTab = (value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value === "overview") params.delete("tab");
    else params.set("tab", value);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  };

  const syncStats = useMemo(() => {
    const finished = (logsQuery.data ?? []).filter((log) => log.type === "SYNC" && log.status !== "RUNNING");
    const succeeded = finished.filter((log) => log.status === "SUCCESS");
    return {
      total: finished.length,
      rate: finished.length > 0 ? Math.round((succeeded.length / finished.length) * 100) : null,
      lastRecords: succeeded[0]?.recordsProcessed ?? null,
    };
  }, [logsQuery.data]);

  if (providerQuery.isPending) return <DetailSkeleton />;

  if (providerQuery.isError || !provider) {
    const notFound = isApiError(providerQuery.error) && providerQuery.error.status === 404;
    return (
      <Card>
        {notFound ? (
          <EmptyState
            icon={PlugZap}
            title="Không tìm thấy nhà cung cấp"
            description="Nhà cung cấp có thể đã bị xóa hoặc đường dẫn không chính xác."
            action={
              <Button asChild variant="outline">
                <Link href="/providers">
                  <ArrowLeft aria-hidden />
                  Về danh sách
                </Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={providerQuery.error} onRetry={() => void providerQuery.refetch()} />
        )}
      </Card>
    );
  }

  const syncMeta = SYNC_STATUS_META[provider.lastSyncStatus];

  return (
    <div className="space-y-6">
      <Link
        href="/providers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Tất cả nhà cung cấp
      </Link>

      <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <ProviderIcon category={provider.category} status={provider.status} size="lg" />
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{provider.name}</h1>
              <ProviderStatusBadge status={provider.status} />
              <DataSourceBadge />
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="font-mono">{provider.code}</span>
              <span aria-hidden>·</span>
              <span>{CATEGORY_META[provider.category].label}</span>
              <span aria-hidden>·</span>
              <span>Tạo {formatRelative(provider.createdAt)}</span>
            </p>
            {provider.description ? (
              <p className="max-w-2xl text-sm text-muted-foreground">{provider.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Can policy={POLICIES.providers.test}>
            <Button variant="outline" onClick={actions.test} isLoading={actions.isTesting}>
              {actions.isTesting ? null : <PlugZap aria-hidden />}
              Kiểm tra kết nối
            </Button>
          </Can>
          <Can policy={POLICIES.providers.sync}>
            <Hint label="Kích hoạt nhà cung cấp để đồng bộ" disabled={actions.canSync}>
              <span className="inline-flex">
                <Button onClick={actions.sync} disabled={!actions.canSync || actions.isSyncing}>
                  <RefreshCw className={actions.isSyncing ? "animate-spin" : undefined} aria-hidden />
                  {actions.isSyncing ? "Đang đồng bộ…" : "Đồng bộ ngay"}
                </Button>
              </span>
            </Hint>
          </Can>
          <Can policy={POLICIES.providers.remove}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Thao tác khác">
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem tone="danger" onSelect={() => setConfirmDelete(true)}>
                  <Trash2 aria-hidden />
                  Xóa nhà cung cấp
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Can>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Activity aria-hidden />
            Tổng quan
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings2 aria-hidden />
            Cấu hình
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Timer aria-hidden />
            Nhật ký
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <StatTile
              label="Đồng bộ gần nhất"
              value={syncMeta.label}
              icon={RefreshCw}
              tone={
                provider.lastSyncStatus === "FAILED"
                  ? "danger"
                  : provider.lastSyncStatus === "SUCCESS"
                    ? "success"
                    : "info"
              }
              hint={provider.lastSyncAt ? formatRelative(provider.lastSyncAt) : "Chưa có dữ liệu"}
            />
            <StatTile
              label="Tỷ lệ thành công"
              value={syncStats.rate !== null ? `${syncStats.rate}%` : "—"}
              icon={Gauge}
              tone="primary"
              loading={logsQuery.isPending}
              hint={syncStats.total > 0 ? `Trên ${syncStats.total} lần đồng bộ gần nhất` : "Chưa có lần đồng bộ nào"}
            />
            <StatTile
              label="Bản ghi lần gần nhất"
              value={syncStats.lastRecords !== null ? formatNumber(syncStats.lastRecords) : "—"}
              icon={Activity}
              tone="info"
              loading={logsQuery.isPending}
              hint={syncIntervalLabel(provider.syncIntervalMinutes)}
            />
            <StatTile
              label="Độ trễ kết nối"
              value={provider.lastLatencyMs !== null ? `${provider.lastLatencyMs} ms` : "—"}
              icon={Timer}
              tone={provider.lastLatencyMs === null ? "neutral" : provider.lastLatencyMs > 1000 ? "warning" : "success"}
              hint={
                provider.lastConnectionCheckAt
                  ? `Đo ${formatRelative(provider.lastConnectionCheckAt)}`
                  : "Chưa kiểm tra"
              }
            />
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Lịch sử đồng bộ</CardTitle>
                <CardDescription>
                  Mỗi cột là một lần đồng bộ. Di chuột để xem chi tiết, hoặc mở tab Nhật ký để xem dạng bảng.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-subtle px-3 py-2.5">
                <SyncSummary provider={provider} />
              </div>
              {logsQuery.isPending ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <SyncHistoryStrip logs={logsQuery.data ?? []} />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <ConnectionCard provider={provider} onTest={actions.test} isTesting={actions.isTesting} />
            {logsQuery.isPending ? (
              <Skeleton className="h-72 rounded-xl" />
            ) : (
              <RecentActivity logs={logsQuery.data ?? []} onViewAll={() => setTab("logs")} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="overflow-hidden">
            {!canUpdate ? (
              <div className="border-b bg-subtle px-5 py-3 text-[13px] text-muted-foreground">
                Bạn đang xem ở chế độ chỉ đọc vì chưa có quyền cập nhật nhà cung cấp.
              </div>
            ) : null}
            <ProviderForm
              key={provider.updatedAt}
              id="provider-settings"
              provider={provider}
              readOnly={!canUpdate}
              bodyClassName="p-5 sm:p-6"
              onSubmit={(values) => {
                const { code: _code, ...input } = toProviderInput(values);
                return updateProvider
                  .mutateAsync(input)
                  .then(() => toast.success("Đã lưu cấu hình", { description: provider.name }));
              }}
              footer={({ isSubmitting, isDirty, reset }) =>
                canUpdate ? (
                  <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-card/95 px-5 py-3 backdrop-blur">
                    <p className="text-[13px] text-muted-foreground" aria-live="polite">
                      {isDirty ? (
                        <span className="font-medium text-warning">Có thay đổi chưa lưu</span>
                      ) : (
                        `Cập nhật ${formatRelative(provider.updatedAt)}`
                      )}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={reset}
                        disabled={!isDirty || isSubmitting}
                      >
                        Hoàn tác
                      </Button>
                      <Button type="submit" size="sm" disabled={!isDirty} isLoading={isSubmitting}>
                        Lưu cấu hình
                      </Button>
                    </div>
                  </div>
                ) : null
              }
            />
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="overflow-hidden">
            <ProviderLogs
              logs={logsQuery.data}
              isPending={logsQuery.isPending}
              error={logsQuery.error}
              onRetry={() => void logsQuery.refetch()}
            />
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Xóa “${provider.name}”?`}
        description="Cấu hình kết nối, thông tin xác thực và toàn bộ nhật ký của nhà cung cấp này sẽ bị xóa. Thao tác này không thể hoàn tác."
        confirmLabel="Xóa nhà cung cấp"
        tone="danger"
        isPending={deleteProvider.isPending}
        onConfirm={() =>
          deleteProvider.mutate(provider.id, {
            onSuccess: () => {
              toast.success("Đã xóa nhà cung cấp", { description: provider.name });
              router.replace("/providers");
            },
          })
        }
      />
    </div>
  );
}
