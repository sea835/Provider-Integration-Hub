"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "@/lib/api/types";
import { niceTicks, smoothPath } from "@/lib/chart";
import { formatNumber } from "@/lib/format";
import { useElementWidth } from "@/lib/use-element-width";
import { cn } from "@/lib/utils";
import { monthlySeries } from "./user-series";

const HEIGHT = 252;
const PAD = { top: 20, right: 16, bottom: 32, left: 40 };
const EDGE = 14;

const RANGES = [
  { value: "6", label: "6 tháng" },
  { value: "12", label: "12 tháng" },
];

const SERIES = [
  { key: "total", label: "Tích lũy", color: "var(--chart-1)" },
  { key: "created", label: "Tạo mới", color: "var(--chart-2)" },
] as const;

export function GrowthChartCard({
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
  const [range, setRange] = useState("6");
  const [active, setActive] = useState<number | null>(null);
  const [setElement, width] = useElementWidth<HTMLDivElement>();

  const points = monthlySeries(users ?? [], Number(range), now);
  const scale = niceTicks(Math.max(...points.map((point) => point.total)));
  const innerWidth = Math.max(0, width - PAD.left - PAD.right);
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const last = points.length - 1;
  const x = (index: number) => PAD.left + EDGE + (last === 0 ? 0 : (index * (innerWidth - EDGE * 2)) / last);
  const y = (value: number) => PAD.top + innerHeight * (1 - value / scale.max);
  const baseline = y(0);
  const labelEvery = innerWidth / points.length < 44 ? 2 : 1;

  const totalLine = smoothPath(points.map((point, index) => [x(index), y(point.total)]));
  const createdLine = smoothPath(points.map((point, index) => [x(index), y(point.created)]));
  const activePoint = active === null ? null : points[active];

  const nearest = (offset: number) => {
    let best = 0;
    for (let index = 1; index <= last; index += 1) {
      if (Math.abs(x(index) - offset) < Math.abs(x(best) - offset)) best = index;
    }
    return best;
  };

  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-[30px] leading-none font-bold tracking-tight">
            {isPending ? "-" : formatNumber(users?.length ?? 0)}
          </p>
          <h2 className="mt-2 text-[15px] leading-tight font-medium text-primary">Tổng người dùng</h2>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <ul className="flex items-center gap-4 text-[13px] text-muted-foreground">
            {SERIES.map((series) => (
              <li key={series.key} className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: series.color }} aria-hidden />
                {series.label}
              </li>
            ))}
          </ul>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger
              className="h-9 w-[7.25rem] bg-card shadow-[inset_0_0_0_1px_var(--color-border)]"
              aria-label="Khoảng thời gian"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isPending ? (
        <Skeleton className="mt-5 w-full rounded-lg" style={{ height: HEIGHT }} />
      ) : (
        <div
          ref={setElement}
          role="group"
          tabIndex={0}
          aria-label="Biểu đồ người dùng theo tháng. Dùng phím mũi tên trái, phải để xem từng tháng."
          className="relative mt-5 rounded-lg outline-offset-4"
          style={{ height: HEIGHT }}
          onPointerMove={(event) =>
            setActive(nearest(event.clientX - event.currentTarget.getBoundingClientRect().left))
          }
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((current) => current ?? last)}
          onBlur={() => setActive(null)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") setActive((current) => Math.max(0, (current ?? last) - 1));
            if (event.key === "ArrowRight") setActive((current) => Math.min(last, (current ?? last) + 1));
            if (event.key === "Escape") setActive(null);
          }}
        >
          {width > 0 ? (
            <svg width={width} height={HEIGHT} aria-hidden className="block">
              <defs>
                <linearGradient id="growth-wash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {scale.ticks.map((tick) => (
                <g key={tick}>
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
              {points.map((point, index) =>
                (last - index) % labelEvery === 0 ? (
                  <text
                    key={point.key}
                    x={x(index)}
                    y={HEIGHT - 8}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[11px]"
                  >
                    {point.label}
                  </text>
                ) : null,
              )}
              <path d={`${totalLine}L${x(last)},${baseline}L${x(0)},${baseline}Z`} fill="url(#growth-wash)" />
              <path
                d={createdLine}
                fill="none"
                stroke="var(--chart-2)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={totalLine}
                fill="none"
                stroke="var(--chart-1)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {activePoint && active !== null ? (
                <line
                  x1={x(active)}
                  x2={x(active)}
                  y1={PAD.top}
                  y2={baseline}
                  stroke="var(--color-input)"
                  strokeWidth="1"
                />
              ) : null}
              {SERIES.map((series) => {
                const index = active ?? last;
                return (
                  <circle
                    key={series.key}
                    cx={x(index)}
                    cy={y(points[index][series.key])}
                    r="5"
                    fill={series.color}
                    stroke="var(--color-card)"
                    strokeWidth="2"
                  />
                );
              })}
            </svg>
          ) : null}
          {activePoint && active !== null && width > 0 ? (
            <ChartTooltip
              left={Math.min(Math.max(x(active), 80), width - 80)}
              top={Math.min(y(activePoint.total), y(activePoint.created)) - 12}
              title={activePoint.longLabel}
              rows={SERIES.map((series) => ({
                label: series.label,
                value: formatNumber(activePoint[series.key]),
                color: series.color,
              }))}
            />
          ) : null}
          <table className="sr-only">
            <caption>Người dùng theo tháng</caption>
            <thead>
              <tr>
                <th scope="col">Tháng</th>
                {SERIES.map((series) => (
                  <th key={series.key} scope="col">
                    {series.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.key}>
                  <th scope="row">{point.longLabel}</th>
                  <td>{point.total}</td>
                  <td>{point.created}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
