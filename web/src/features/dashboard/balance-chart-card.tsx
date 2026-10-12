"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RANGE_OPTIONS, SERIES_COLORS } from "@/features/providers/constants";
import { useSeries } from "@/features/providers/hooks";
import type { Provider, SeriesRange } from "@/features/providers/types";
import { niceTicks } from "@/lib/chart";
import { formatCompact, formatDateTime, formatMoney } from "@/lib/format";
import { useElementWidth } from "@/lib/use-element-width";
import { cn } from "@/lib/utils";

const HEIGHT = 264;
const PAD = { top: 16, right: 16, bottom: 30, left: 52 };
const MAX_SERIES = SERIES_COLORS.length;
const TICK_COUNT = 5;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const SPAN_MS: Record<SeriesRange, number> = {
  "5m": 5 * MINUTE_MS,
  "15m": 15 * MINUTE_MS,
  "30m": 30 * MINUTE_MS,
  "60m": HOUR_MS,
  "3h": 3 * HOUR_MS,
  "12h": 12 * HOUR_MS,
  "24h": 24 * HOUR_MS,
  "7d": 168 * HOUR_MS,
  "30d": 720 * HOUR_MS,
};

const secondFormatter = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const timeFormatter = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" });
const dayFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" });

function tickFormatterOf(range: SeriesRange): Intl.DateTimeFormat {
  if (range === "5m" || range === "15m") return secondFormatter;
  return range === "7d" || range === "30d" ? dayFormatter : timeFormatter;
}

interface Line {
  id: string;
  name: string;
  color: string;
  points: Array<{ time: number; balance: number }>;
}

function nearestPoint(line: Line, time: number) {
  let best = line.points[0];
  for (const point of line.points) {
    if (Math.abs(point.time - time) < Math.abs(best.time - time)) best = point;
  }
  return best;
}

export function BalanceChartCard({
  providers,
  isPending,
  now,
  className,
}: {
  providers: Provider[] | undefined;
  isPending: boolean;
  now: Date;
  className?: string;
}) {
  const [range, setRange] = useState<SeriesRange>("24h");
  const [hidden, setHidden] = useState<string[]>([]);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [setElement, width] = useElementWidth<HTMLDivElement>();

  const shown = (providers ?? []).slice(0, MAX_SERIES);
  const series = useSeries(
    range,
    shown.map((provider) => provider.id),
  );

  const lines: Line[] = shown.map((provider, index) => ({
    id: provider.id,
    name: provider.name,
    color: SERIES_COLORS[index],
    points: (series.data?.find((item) => item.providerId === provider.id)?.points ?? []).map((point) => ({
      time: new Date(point.at).getTime(),
      balance: point.balance,
    })),
  }));
  const visible = lines.filter((line) => !hidden.includes(line.id) && line.points.length > 0);

  const end = now.getTime();
  const start = end - SPAN_MS[range];
  const scale = niceTicks(Math.max(0, ...visible.flatMap((line) => line.points.map((point) => point.balance))));
  const innerWidth = Math.max(0, width - PAD.left - PAD.right);
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (time: number) => PAD.left + ((Math.min(Math.max(time, start), end) - start) / (end - start)) * innerWidth;
  const y = (value: number) => PAD.top + innerHeight * (1 - value / scale.max);
  const tickLabel = tickFormatterOf(range);

  const readings = hoverTime === null ? [] : visible.map((line) => ({ line, point: nearestPoint(line, hoverTime) }));
  const anchor = readings.reduce<(typeof readings)[number] | null>(
    (best, item) =>
      hoverTime !== null && (!best || Math.abs(item.point.time - hoverTime) < Math.abs(best.point.time - hoverTime))
        ? item
        : best,
    null,
  );

  const loading = isPending || (series.isPending && shown.length > 0);

  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h2 className="text-base leading-tight font-semibold tracking-tight">Số dư theo thời gian</h2>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
            {(providers?.length ?? 0) > MAX_SERIES
              ? `Hiển thị ${MAX_SERIES} đối tác đầu theo tên. Bấm vào tên để ẩn hoặc hiện.`
              : "Bấm vào tên đối tác để ẩn hoặc hiện đường của nó."}
          </p>
        </div>
        <Select value={range} onValueChange={(value) => setRange(value as SeriesRange)}>
          <SelectTrigger
            className="h-9 w-[7.25rem] bg-card shadow-[inset_0_0_0_1px_var(--color-border)]"
            aria-label="Khoảng thời gian"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {lines.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {lines.map((line) => {
            const off = hidden.includes(line.id);
            return (
              <li key={line.id}>
                <button
                  type="button"
                  aria-pressed={!off}
                  onClick={() =>
                    setHidden((current) => (off ? current.filter((id) => id !== line.id) : [...current, line.id]))
                  }
                  className={cn(
                    "flex h-7 items-center gap-2 rounded-full px-2.5 text-xs font-medium transition-colors duration-150",
                    off ? "bg-transparent text-muted-foreground line-through" : "bg-subtle text-foreground",
                  )}
                >
                  <span
                    className="h-0.5 w-3.5 rounded-full"
                    style={{ backgroundColor: off ? "var(--color-input)" : line.color }}
                    aria-hidden
                  />
                  {line.name}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {loading ? (
        <Skeleton className="mt-4 w-full rounded-lg" style={{ height: HEIGHT }} />
      ) : (
        <div
          ref={setElement}
          className={cn("relative mt-4 transition-opacity", series.isPlaceholderData && "opacity-60")}
          style={{ height: HEIGHT }}
          onPointerMove={(event) => {
            const offset = event.clientX - event.currentTarget.getBoundingClientRect().left - PAD.left;
            setHoverTime(start + (Math.min(Math.max(offset, 0), innerWidth) / Math.max(1, innerWidth)) * (end - start));
          }}
          onPointerLeave={() => setHoverTime(null)}
        >
          {width > 0 ? (
            <svg width={width} height={HEIGHT} aria-hidden className="block">
              {scale.ticks.map((tick) => (
                <g key={tick}>
                  <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--chart-grid)" />
                  <text
                    x={PAD.left - 10}
                    y={y(tick) + 4}
                    textAnchor="end"
                    className="fill-muted-foreground text-[11px] tabular-nums"
                  >
                    {formatCompact(tick)}
                  </text>
                </g>
              ))}
              {Array.from({ length: TICK_COUNT }, (_, index) => {
                const time = start + ((end - start) * index) / (TICK_COUNT - 1);
                return (
                  <text
                    key={index}
                    x={x(time)}
                    y={HEIGHT - 8}
                    textAnchor={index === 0 ? "start" : index === TICK_COUNT - 1 ? "end" : "middle"}
                    className="fill-muted-foreground text-[11px] tabular-nums"
                  >
                    {tickLabel.format(time)}
                  </text>
                );
              })}
              {anchor ? (
                <line
                  x1={x(anchor.point.time)}
                  x2={x(anchor.point.time)}
                  y1={PAD.top}
                  y2={y(0)}
                  stroke="var(--color-input)"
                />
              ) : null}
              {visible.map((line) => (
                <path
                  key={line.id}
                  d={line.points
                    .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.time)},${y(point.balance)}`)
                    .join("")}
                  fill="none"
                  stroke={line.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {visible.map((line) => {
                const point = readings.find((item) => item.line.id === line.id)?.point ?? line.points.at(-1);
                return point ? (
                  <circle
                    key={line.id}
                    cx={x(point.time)}
                    cy={y(point.balance)}
                    r="4.5"
                    fill={line.color}
                    stroke="var(--color-card)"
                    strokeWidth="2"
                  />
                ) : null;
              })}
            </svg>
          ) : null}
          {visible.length === 0 && width > 0 ? (
            <p className="pointer-events-none absolute inset-x-0 top-[40%] px-10 text-center text-[13px] text-muted-foreground">
              {lines.length === 0
                ? "Chưa có đối tác nào để vẽ biểu đồ"
                : "Chưa có lần kiểm tra thành công nào trong khoảng này"}
            </p>
          ) : null}
          {anchor && width > 0 ? (
            <ChartTooltip
              left={Math.min(Math.max(x(anchor.point.time), 110), width - 110)}
              top={Math.min(...readings.map((item) => y(item.point.balance))) - 12}
              title={formatDateTime(anchor.point.time)}
              rows={readings.map((item) => ({
                label: item.line.name,
                value: formatMoney(item.point.balance),
                color: item.line.color,
              }))}
            />
          ) : null}
          <table className="sr-only">
            <caption>Số dư mới nhất của từng đối tác trong khoảng đang chọn</caption>
            <thead>
              <tr>
                <th scope="col">Đối tác</th>
                <th scope="col">Số dư mới nhất</th>
                <th scope="col">Thời điểm</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const last = line.points.at(-1);
                return (
                  <tr key={line.id}>
                    <th scope="row">{line.name}</th>
                    <td>{last ? formatMoney(last.balance) : "Chưa có dữ liệu"}</td>
                    <td>{last ? formatDateTime(last.time) : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
