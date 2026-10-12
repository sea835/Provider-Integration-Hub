"use client";

import { ArrowClockwise, PlugsConnected, Plus, Pulse, Wallet, Warning, WifiSlash } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Can } from "@/features/auth/session-provider";
import { POLICIES } from "@/lib/auth/policies";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { intervalLabel } from "./constants";
import { useProviders } from "./hooks";
import { ProviderActions } from "./provider-actions";
import { ProviderFormDialog } from "./provider-form-dialog";
import { BalanceText, LastCheck, LevelBadge, StatusBadge } from "./provider-visuals";
import type { Provider } from "./types";

export function summarize(providers: Provider[]) {
  const withBalance = providers.filter((provider) => provider.currentBalance !== null);
  return {
    total: withBalance.reduce((sum, provider) => sum + (provider.currentBalance ?? 0), 0),
    hasBalance: withBalance.length > 0,
    warning: withBalance.filter((provider) => provider.level === "WARNING").length,
    critical: withBalance.filter((provider) => provider.level === "CRITICAL").length,
    failing: providers.filter((provider) => provider.connectionFailing).length,
    active: providers.filter((provider) => provider.status === "ACTIVE").length,
  };
}

function Thresholds({ provider }: { provider: Provider }) {
  if (provider.warningThreshold === null && provider.criticalThreshold === null) {
    return <span className="text-muted-foreground">Chưa đặt</span>;
  }
  return (
    <span className="grid gap-0.5 text-[13px] whitespace-nowrap tabular-nums">
      <span>
        <span className="text-muted-foreground">Sớm:</span> {formatMoney(provider.warningThreshold)}
      </span>
      <span>
        <span className="text-muted-foreground">Khẩn cấp:</span> {formatMoney(provider.criticalThreshold)}
      </span>
    </span>
  );
}

export function ProvidersView() {
  const router = useRouter();
  const { data: providers, isPending, isError, error, refetch, isFetching } = useProviders();
  const [createOpen, setCreateOpen] = useState(false);
  const summary = summarize(providers ?? []);
  const needTopUp = summary.warning + summary.critical;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Giám sát số dư"
        title="Đối tác"
        description="Số dư ví API của từng nhà mạng, ngưỡng cảnh báo và lịch quét tự động."
        stats={[
          {
            label: "Tổng số dư",
            value: isPending ? "-" : summary.hasBalance ? formatMoney(summary.total) : "-",
            icon: Wallet,
          },
          {
            label: "Cần nạp tiền",
            value: isPending ? "-" : formatNumber(needTopUp),
            icon: Warning,
            tone: needTopUp > 0 ? "danger" : "success",
            hint: isPending ? undefined : `${summary.critical} khẩn cấp, ${summary.warning} sắp hết`,
          },
          {
            label: "Lỗi kết nối",
            value: isPending ? "-" : formatNumber(summary.failing),
            icon: WifiSlash,
            tone: summary.failing > 0 ? "danger" : "success",
          },
          {
            label: "Đang quét",
            value: isPending ? "-" : `${summary.active}/${providers?.length ?? 0}`,
            icon: Pulse,
          },
        ]}
        actions={
          <>
            <Can policy={POLICIES.providers.create}>
              <Button variant="inverse" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus aria-hidden />
                Thêm đối tác
              </Button>
            </Can>
            <Button variant="inverse-ghost" size="sm" onClick={() => void refetch()}>
              <ArrowClockwise className={cn(isFetching && "animate-spin")} aria-hidden />
              Tải lại
            </Button>
          </>
        }
      />

      <Card className="p-4">
        {isPending ? (
          <div className="space-y-2" aria-hidden>
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : providers.length === 0 ? (
          <EmptyState
            icon={PlugsConnected}
            title="Chưa có đối tác nào"
            description="Thêm đối tác, cấu hình API số dư rồi bật quét để bắt đầu giám sát."
            action={
              <Can policy={POLICIES.providers.create}>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus aria-hidden />
                  Thêm đối tác
                </Button>
              </Can>
            }
          />
        ) : (
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Đối tác</TableHead>
                <TableHead className="text-right">Số dư</TableHead>
                <TableHead>Mức</TableHead>
                <TableHead>Ngưỡng</TableHead>
                <TableHead>Kiểm tra gần nhất</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Thao tác</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell className="max-w-[280px]">
                    <Link
                      href={`/providers/${provider.id}`}
                      className="block truncate font-semibold text-foreground hover:text-primary hover:underline"
                      title={provider.name}
                    >
                      {provider.name}
                    </Link>
                    <span className="font-mono text-[11px] text-muted-foreground">{provider.code}</span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <BalanceText provider={provider} />
                  </TableCell>
                  <TableCell>
                    <LevelBadge provider={provider} />
                  </TableCell>
                  <TableCell>
                    <Thresholds provider={provider} />
                  </TableCell>
                  <TableCell>
                    <LastCheck provider={provider} />
                  </TableCell>
                  <TableCell>
                    <span className="grid justify-items-start gap-1">
                      <StatusBadge provider={provider} />
                      <span className="text-[11px] whitespace-nowrap text-muted-foreground">
                        {provider.readinessIssues.length > 0
                          ? "Chưa cấu hình xong"
                          : `Mỗi ${intervalLabel(provider.intervalMinutes)}`}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <ProviderActions provider={provider} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {createOpen ? (
        <ProviderFormDialog
          onClose={() => setCreateOpen(false)}
          onCreated={(provider) => router.push(`/providers/${provider.id}`)}
        />
      ) : null}
    </div>
  );
}
