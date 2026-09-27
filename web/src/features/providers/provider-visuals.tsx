import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CATEGORY_META, LOG_STATUS_META, STATUS_META } from "./constants";
import type { Provider, ProviderCategory, ProviderLogStatus, ProviderStatus } from "./types";

const ICON_TONE: Record<ProviderStatus, string> = {
  ACTIVE: "bg-primary-soft text-primary",
  INACTIVE: "bg-muted text-muted-foreground",
  ERROR: "bg-danger-soft text-danger",
};

export function ProviderIcon({
  category,
  status,
  size = "md",
}: {
  category: ProviderCategory;
  status: ProviderStatus;
  size?: "md" | "lg";
}) {
  const Icon = CATEGORY_META[category].icon;
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        ICON_TONE[status],
        size === "lg" ? "size-14 [&_svg]:size-6" : "size-10 [&_svg]:size-5",
      )}
    >
      <Icon />
    </span>
  );
}

export function ProviderStatusBadge({ status }: { status: ProviderStatus }) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {meta.label}
    </Badge>
  );
}

export function LogStatusBadge({ status }: { status: ProviderLogStatus }) {
  const meta = LOG_STATUS_META[status];
  return (
    <Badge tone={meta.tone}>
      {status === "RUNNING" ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {meta.label}
    </Badge>
  );
}

export function SyncSummary({ provider, className }: { provider: Provider; className?: string }) {
  const { lastSyncStatus, lastSyncAt, lastSyncMessage } = provider;

  if (lastSyncStatus === "RUNNING") {
    return (
      <p className={cn("flex items-center gap-2 text-[13px] font-medium text-info", className)} role="status">
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        Đang đồng bộ dữ liệu…
      </p>
    );
  }

  if (lastSyncStatus === "NEVER" || !lastSyncAt) {
    return (
      <p className={cn("flex items-center gap-2 text-[13px] text-muted-foreground", className)}>
        <CircleDashed className="size-4 shrink-0" aria-hidden />
        Chưa từng đồng bộ
      </p>
    );
  }

  const success = lastSyncStatus === "SUCCESS";
  return (
    <div className={cn("min-w-0 text-[13px]", className)}>
      <p className={cn("flex items-center gap-2 font-medium", success ? "text-success" : "text-danger")}>
        {success ? (
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
        ) : (
          <XCircle className="size-4 shrink-0" aria-hidden />
        )}
        <span>
          {success ? "Đồng bộ thành công" : "Đồng bộ thất bại"}
          <span className="font-normal text-muted-foreground">
            {" · "}
            <time dateTime={lastSyncAt} title={formatDateTime(lastSyncAt)}>
              {formatRelative(lastSyncAt)}
            </time>
          </span>
        </span>
      </p>
      {lastSyncMessage ? (
        <p className="mt-1 truncate pl-6 text-muted-foreground" title={lastSyncMessage}>
          {lastSyncMessage}
        </p>
      ) : null}
    </div>
  );
}
