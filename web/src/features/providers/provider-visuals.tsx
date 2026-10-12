import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatMoney, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CHECK_META, LEVEL_META, STATUS_META } from "./constants";
import type { Provider } from "./types";

export function LevelBadge({ provider }: { provider: Provider }) {
  if (provider.currentBalance === null) return <Badge tone="neutral">Chưa có số dư</Badge>;
  const meta = LEVEL_META[provider.level];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function StatusBadge({ provider }: { provider: Provider }) {
  const meta = STATUS_META[provider.status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function BalanceText({ provider, className }: { provider: Provider; className?: string }) {
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        provider.level === "CRITICAL" && provider.currentBalance !== null && "text-danger",
        className,
      )}
    >
      {formatMoney(provider.currentBalance)}
    </span>
  );
}

export function LastCheck({ provider }: { provider: Provider }) {
  if (!provider.lastCheckedAt || !provider.lastStatus) {
    return <span className="text-muted-foreground">Chưa kiểm tra</span>;
  }
  const meta = CHECK_META[provider.lastStatus];
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <time
        dateTime={provider.lastCheckedAt}
        title={formatDateTime(provider.lastCheckedAt)}
        className="whitespace-nowrap text-muted-foreground"
      >
        {formatRelative(provider.lastCheckedAt)}
      </time>
      {provider.connectionFailing ? (
        <Badge tone="danger">Lỗi {provider.consecutiveFailures} lần liên tiếp</Badge>
      ) : (
        <Badge tone={meta.tone}>{meta.label}</Badge>
      )}
    </span>
  );
}
