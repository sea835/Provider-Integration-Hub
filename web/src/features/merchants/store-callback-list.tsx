"use client";

import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useRetryStoreCallback } from "./hooks";
import type { StoreCallback, StoreCallbackStatus } from "./types";

export const CALLBACK_EVENT_LABELS: Record<string, string> = {
  "order.completed": "Đơn thành công",
  "order.failed": "Đơn thất bại",
  "order.cancelled": "Đơn đã huỷ",
  ping: "Gửi thử",
};

const STATUS_META: Record<StoreCallbackStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Đang gửi", tone: "info" },
  DELIVERED: { label: "Store đã nhận", tone: "success" },
  FAILED: { label: "Gửi thất bại", tone: "danger" },
  SKIPPED: { label: "Bỏ qua", tone: "neutral" },
};

function timing(callback: StoreCallback): string {
  if (callback.status === "DELIVERED" && callback.deliveredAt) {
    return `Store nhận lúc ${formatDateTime(callback.deliveredAt)}`;
  }
  if (callback.status === "PENDING" && callback.attempts > 0 && callback.nextAttemptAt) {
    return `Gửi lại ${formatRelative(callback.nextAttemptAt)}`;
  }
  if (callback.status === "SKIPPED") return "Store chưa bật callback lúc đơn chốt";
  return `Tạo lúc ${formatDateTime(callback.createdAt)}`;
}

function CallbackItem({ callback, showTransCode }: { callback: StoreCallback; showTransCode: boolean }) {
  const retry = useRetryStoreCallback();
  const meta = STATUS_META[callback.status];
  const canRetry = !(callback.status === "PENDING" && callback.attempts === 0);

  const resend = () =>
    retry.mutate(callback.id, {
      onSuccess: () => toast.success("Đã cho gửi lại callback", { description: callback.transCode }),
      onError: (error) => toast.error("Không gửi lại được", { description: getErrorMessage(error) }),
    });

  return (
    <li className="grid gap-1.5 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{CALLBACK_EVENT_LABELS[callback.event] ?? callback.event}</span>
        <Badge tone={meta.tone}>{meta.label}</Badge>
        {callback.attempts > 0 ? (
          <span className="text-[12px] text-muted-foreground">gửi {callback.attempts} lần</span>
        ) : null}
        {callback.lastHttpStatus ? (
          <span className="font-mono text-[11.5px] text-muted-foreground">HTTP {callback.lastHttpStatus}</span>
        ) : null}
        {callback.lastDurationMs !== null ? (
          <span className="font-mono text-[11.5px] text-muted-foreground">{callback.lastDurationMs} ms</span>
        ) : null}
        {canRetry ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={resend}
            isLoading={retry.isPending}
            aria-label={`Gửi lại callback ${callback.transCode}`}
          >
            {retry.isPending ? null : <RotateCcw aria-hidden />}
            Gửi lại
          </Button>
        ) : null}
      </div>
      <p className="text-[12px] text-muted-foreground">
        {showTransCode ? <span className="font-mono">{callback.transCode} · </span> : null}
        {timing(callback)}
      </p>
      {callback.lastError && (callback.status === "PENDING" || callback.status === "FAILED") ? (
        <p className="text-[13px] break-words text-danger">{callback.lastError}</p>
      ) : null}
      {callback.lastResponse ? (
        <details className="rounded-md border bg-subtle">
          <summary className="cursor-pointer px-3 py-1.5 text-[12px] font-medium text-muted-foreground select-none hover:text-foreground">
            Store trả lời
          </summary>
          <pre className="max-h-40 scrollbar-thin overflow-auto border-t px-3 py-2 font-mono text-[11.5px] whitespace-pre-wrap">
            {callback.lastResponse}
          </pre>
        </details>
      ) : null}
    </li>
  );
}

export function StoreCallbackList({
  callbacks,
  isPending,
  error,
  onRetry,
  showTransCode = false,
  emptyText,
}: {
  callbacks: StoreCallback[] | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  showTransCode?: boolean;
  emptyText: string;
}) {
  if (isPending) {
    return (
      <div className="grid gap-3" aria-hidden>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={onRetry} className="py-6" />;
  if (!callbacks || callbacks.length === 0) {
    return <p className="text-[13px] text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="divide-y">
      {callbacks.map((callback) => (
        <CallbackItem key={callback.id} callback={callback} showTransCode={showTransCode} />
      ))}
    </ul>
  );
}
