import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

const ICON_TONES = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-muted text-muted-foreground",
} as const;

interface StatTileProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof ICON_TONES;
  hint?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "primary",
  hint,
  loading = false,
  className,
}: StatTileProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border bg-card p-4 shadow-soft sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <span
          className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", ICON_TONES[tone])}
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p className="mt-2 text-[28px] leading-none font-semibold tracking-tight">{value}</p>
      )}
      {hint ? (
        <div className="mt-3 text-xs text-muted-foreground">{loading ? <Skeleton className="h-3.5 w-32" /> : hint}</div>
      ) : null}
    </div>
  );
}
