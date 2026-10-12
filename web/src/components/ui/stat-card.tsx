import type { Icon as IconType } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "./card";

export type StatTone = "primary" | "success" | "danger" | "neutral";

const ICON_TONES: Record<StatTone, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-muted text-muted-foreground",
};

export interface Stat {
  label: string;
  value: ReactNode;
  icon: IconType;
  tone?: StatTone;
  hint?: ReactNode;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  hint,
  className,
}: Stat & { className?: string }) {
  return (
    <Card className={cn("flex items-center gap-3.5 p-4", className)}>
      <span
        className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", ICON_TONES[tone])}
        aria-hidden
      >
        <Icon className="size-5" weight="fill" />
      </span>
      <div className="min-w-0">
        <p className="text-[26px] leading-none font-bold tracking-tight">{value}</p>
        <p className="mt-2 text-sm leading-tight font-medium text-primary">{label}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </Card>
  );
}
