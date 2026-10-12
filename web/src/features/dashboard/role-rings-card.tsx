"use client";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLE_OPTIONS } from "@/features/users/constants";
import type { User } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const SIZE = 148;
const STROKE = 10;
const STEP = 18;
const ROLE_COLORS: Record<string, string> = {
  ADMIN: "var(--chart-1)",
  MANAGER: "var(--chart-2)",
  USER: "var(--chart-3)",
};
const OTHER_COLOR = "var(--color-muted-foreground)";

export function RoleRingsCard({
  users,
  isPending,
  className,
}: {
  users: User[] | undefined;
  isPending: boolean;
  className?: string;
}) {
  const list = users ?? [];
  const known = new Set<string>(ROLE_OPTIONS.map((option) => option.value));
  const otherCount = list.filter((user) => !known.has(user.role)).length;
  const rows = [
    ...ROLE_OPTIONS.map((option) => ({
      key: option.value as string,
      label: option.label,
      count: list.filter((user) => user.role === option.value).length,
      color: ROLE_COLORS[option.value] ?? OTHER_COLOR,
    })),
    ...(otherCount > 0 ? [{ key: "OTHER", label: "Vai trò khác", count: otherCount, color: OTHER_COLOR }] : []),
  ];
  const total = Math.max(1, list.length);

  return (
    <Card className={cn("flex flex-col p-4 sm:p-5", className)}>
      <CardTitle>Người dùng theo vai trò</CardTitle>
      <CardDescription>Tỷ lệ tài khoản đang mang từng vai trò</CardDescription>

      {isPending ? (
        <div className="mt-6 flex items-center gap-6" aria-hidden>
          <Skeleton className="size-36 shrink-0 rounded-full" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-1 flex-wrap items-center justify-center gap-x-6 gap-y-5">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0" aria-hidden>
            {rows.map((row, index) => {
              const radius = SIZE / 2 - STROKE / 2 - index * STEP;
              const circumference = 2 * Math.PI * radius;
              const share = row.count / total;
              return (
                <g key={row.key} transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
                  <circle
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={radius}
                    fill="none"
                    stroke={row.color}
                    strokeOpacity="0.16"
                    strokeWidth={STROKE}
                  />
                  {share > 0 ? (
                    <circle
                      cx={SIZE / 2}
                      cy={SIZE / 2}
                      r={radius}
                      fill="none"
                      stroke={row.color}
                      strokeWidth={STROKE}
                      strokeLinecap="round"
                      strokeDasharray={`${Math.max(0.01, share * circumference - (share < 1 ? STROKE : 0))} ${circumference}`}
                    />
                  ) : null}
                </g>
              );
            })}
          </svg>
          <ul className="min-w-28 flex-1 space-y-3.5">
            {rows.map((row) => (
              <li key={row.key}>
                <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden />
                  {row.label}
                </p>
                <p className="mt-1 flex items-baseline gap-2 pl-[18px]">
                  <span className="text-lg leading-none font-bold">{formatNumber(row.count)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {Math.round((row.count / total) * 100)}%
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
