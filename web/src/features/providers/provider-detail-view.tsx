"use client";

import {
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  ClockCounterClockwise,
  Pause,
  Play,
  Pulse,
  SlidersHorizontal,
  Timer,
  Wallet,
  Warning,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { StatTone } from "@/components/ui/stat-card";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { usePermission } from "@/features/auth/session-provider";
import { POLICIES } from "@/lib/auth/policies";
import { formatMoney, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChecksTable } from "./checks-table";
import { ConfigEditor } from "./config/config-editor";
import { CHECK_META, intervalLabel, LEVEL_META, STATUS_META } from "./constants";
import { useHistory, useProvider } from "./hooks";
import { useProviderCommands } from "./provider-actions";
import { ProviderFormDialog } from "./provider-form-dialog";
import type { Provider } from "./types";

const LEVEL_TONES: Record<Provider["level"], StatTone> = { OK: "success", WARNING: "danger", CRITICAL: "danger" };

function HeaderActions({ provider, onEdit }: { provider: Provider; onEdit: () => void }) {
  const commands = useProviderCommands(provider);
  return (
    <>
      <Button
        variant="inverse"
        size="sm"
        disabled={!commands.active}
        isLoading={commands.isChecking}
        onClick={commands.checkNow}
      >
        {commands.isChecking ? null : <ArrowClockwise aria-hidden />}
        Kiểm tra ngay
      </Button>
      <Button variant="inverse-ghost" size="sm" disabled={commands.isToggling} onClick={commands.toggle}>
        {commands.active ? <Pause aria-hidden /> : <Play aria-hidden />}
        {commands.active ? "Tạm dừng quét" : "Bật quét"}
      </Button>
      <Button variant="inverse-ghost" size="sm" onClick={onEdit}>
        <SlidersHorizontal aria-hidden />
        Sửa ngưỡng và chu kỳ
      </Button>
    </>
  );
}

function RecentChecks({ provider }: { provider: Provider }) {
  const history = useHistory({ providerId: provider.id, page: 1, limit: 8 });
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Lần kiểm tra gần đây</CardTitle>
          <CardDescription>Mỗi lượt quét nền hoặc Kiểm tra ngay ghi một dòng.</CardDescription>
        </div>
        <Link
          href={`/history?providerId=${provider.id}`}
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
        >
          Xem tất cả
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      <div className={cn("mt-3 transition-opacity", history.isPlaceholderData && "opacity-60")}>
        {history.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : history.isError ? (
          <ErrorState error={history.error} onRetry={() => void history.refetch()} />
        ) : history.data.data.length === 0 ? (
          <EmptyState
            icon={ClockCounterClockwise}
            title="Chưa có lần kiểm tra nào"
            description="Bật quét hoặc bấm Kiểm tra ngay để có dữ liệu."
            className="py-8"
          />
        ) : (
          <ChecksTable checks={history.data.data} />
        )}
      </div>
    </Card>
  );
}

export function ProviderDetailView({ id }: { id: string }) {
  const { data: provider, isPending, isError, error, refetch } = useProvider(id);
  const canUpdate = usePermission(POLICIES.providers.update);
  const canConfigure = usePermission(POLICIES.providers.configure);
  const canViewHistory = usePermission(POLICIES.balanceChecks.view);
  const [editing, setEditing] = useState(false);

  const back = (
    <Link href="/providers" className="inline-flex items-center gap-1 rounded-sm outline-white hover:text-white">
      <ArrowLeft className="size-3.5" aria-hidden />
      Đối tác
    </Link>
  );

  if (isPending) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <PageHeader eyebrow={back} title="Đang tải..." />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader eyebrow={back} title="Không tải được đối tác" />
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      </div>
    );
  }

  const status = STATUS_META[provider.status];
  const hasBalance = provider.currentBalance !== null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={back}
        title={provider.name}
        description={
          <>
            <span className="font-mono">{provider.code}</span> · quét mỗi {intervalLabel(provider.intervalMinutes)} ·
            nhắc lại sau {provider.cooldownMinutes} phút
          </>
        }
        actions={canUpdate ? <HeaderActions provider={provider} onEdit={() => setEditing(true)} /> : undefined}
        stats={[
          {
            label: "Số dư hiện tại",
            value: formatMoney(provider.currentBalance),
            icon: Wallet,
            tone: hasBalance ? LEVEL_TONES[provider.level] : "neutral",
            hint: hasBalance ? LEVEL_META[provider.level].label : "Chưa kiểm tra lần nào",
          },
          {
            label: "Ngưỡng cảnh báo sớm",
            value: formatMoney(provider.warningThreshold),
            icon: Warning,
            tone: "neutral",
            hint: `Khẩn cấp: ${formatMoney(provider.criticalThreshold)}`,
          },
          {
            label: "Kiểm tra gần nhất",
            value: provider.lastCheckedAt ? formatRelative(provider.lastCheckedAt) : "-",
            icon: Timer,
            tone: provider.connectionFailing ? "danger" : "primary",
            hint: provider.connectionFailing
              ? `Lỗi ${provider.consecutiveFailures} lần liên tiếp`
              : provider.lastStatus
                ? CHECK_META[provider.lastStatus].label
                : undefined,
          },
          {
            label: "Trạng thái",
            value: status.label,
            icon: Pulse,
            tone: provider.status === "ACTIVE" ? "success" : "neutral",
          },
        ]}
      />

      {provider.readinessIssues.length > 0 ? (
        <Card className="flex items-start gap-3 p-4">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning"
            aria-hidden
          >
            <Warning className="size-4" weight="fill" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Cấu hình API chưa đủ để bật quét</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-muted-foreground">
              {provider.readinessIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        </Card>
      ) : null}

      <ConfigEditor provider={provider} readOnly={!canConfigure} />

      {canViewHistory ? <RecentChecks provider={provider} /> : null}

      {editing ? <ProviderFormDialog provider={provider} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}
