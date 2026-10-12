"use client";

import { useState } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "@/lib/api/types";
import { niceTicks, roundedTopBar } from "@/lib/chart";
import { formatNumber } from "@/lib/format";
import { useElementWidth } from "@/lib/use-element-width";
import { cn } from "@/lib/utils";
import { dailySeries } from "./user-series";

const HEIGHT = 208;
const PAD = { top: 16, right: 8, bottom: 30, left: 34 };
const BAR_WIDTH = 16;

export function WeeklySignupsCard({
  users,
  isPending,
  now,
  className,
}: {
  users: User[] | undefined;
  isPending: boolean;
  now: Date;
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [setElement, width] = useElementWidth<HTMLDivElement>();

  const points = dailySeries(users ?? [], 7, now);
  const total = points.reduce((sum, point) => sum + point.created, 0);
  const scale = niceTicks(Math.max(...points.map((point) => point.created)), 3);
  const innerWidth = Math.max(0, width - PAD.left - PAD.right);
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const band = innerWidth / points.length;
  const center = (index: number) => PAD.left + band * (index + 0.5);
  const y = (value: number) => PAD.top + innerHeight * (1 - value / scale.max);
  const baseline = y(0);
  const activePoint = active === null ? null : points[active];

  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Tài khoản mới</CardTitle>
          <CardDescription>7 ngày gần nhất</CardDescription>
        </div>
        <p className="text-right text-[22px] leading-none font-bold tracking-tight">
          {isPending ? "-" : formatNumber(total)}
        </p>
      </div>

      {isPending ? (
        <Skeleton className="mt-5 w-full rounded-lg" style={{ height: HEIGHT }} />
      ) : (
        <div ref={setElement} className="relative mt-5" style={{ height: HEIGHT }}>
          {width > 0 ? (
            <svg
              width={width}
              height={HEIGHT}
              role="group"
              aria-label="Biểu đồ cột số tài khoản mới theo ngày"
              className="block"
            >
              <defs>
                <linearGradient id="signup-bar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.45" />
                </linearGradient>
              </defs>
              {scale.ticks.map((tick) => (
                <g key={tick} aria-hidden>
                  <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--chart-grid)" />
                  <text
                    x={PAD.left - 10}
                    y={y(tick) + 4}
                    textAnchor="end"
                    className="fill-muted-foreground text-[11px] tabular-nums"
                  >
                    {formatNumber(tick)}
                  </text>
                </g>
              ))}
              {points.map((point, index) => (
                <g key={point.key}>
                  {point.created > 0 ? (
                    <path
                      d={roundedTopBar(
                        center(index) - BAR_WIDTH / 2,
                        y(point.created),
                        BAR_WIDTH,
                        baseline - y(point.created),
                        BAR_WIDTH / 2,
                      )}
                      fill="url(#signup-bar)"
                      opacity={active === null || active === index ? 1 : 0.45}
                      className="transition-opacity duration-150"
                      aria-hidden
                    />
                  ) : null}
                  <text
                    x={center(index)}
                    y={HEIGHT - 8}
                    textAnchor="middle"
                    className={cn(
                      "text-[11px]",
                      active === index ? "fill-foreground font-semibold" : "fill-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {point.label}
                  </text>
                  <rect
                    x={PAD.left + band * index}
                    y={PAD.top}
                    width={band}
                    height={innerHeight}
                    fill="transparent"
                    tabIndex={0}
                    role="img"
                    aria-label={`${point.longLabel}: ${formatNumber(point.created)} tài khoản mới`}
                    className="outline-none"
                    onPointerEnter={() => setActive(index)}
                    onPointerLeave={() => setActive(null)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                  />
                </g>
              ))}
            </svg>
          ) : null}
          {total === 0 && width > 0 ? (
            <p className="pointer-events-none absolute inset-x-0 top-[38%] px-10 text-center text-[13px] text-muted-foreground">
              Chưa có tài khoản mới trong 7 ngày qua
            </p>
          ) : null}
          {activePoint && active !== null && width > 0 ? (
            <ChartTooltip
              left={Math.min(Math.max(center(active), 72), width - 72)}
              top={y(activePoint.created) - 10}
              title={activePoint.longLabel}
              rows={[{ label: "tài khoản mới", value: formatNumber(activePoint.created), color: "var(--chart-1)" }]}
            />
          ) : null}
        </div>
      )}
    </Card>
  );
}
