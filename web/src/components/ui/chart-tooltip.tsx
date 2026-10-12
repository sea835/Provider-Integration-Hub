export interface ChartTooltipRow {
  label: string;
  value: string;
  color: string;
}

export function ChartTooltip({
  left,
  top,
  title,
  rows,
}: {
  left: number;
  top: number;
  title: string;
  rows: ChartTooltipRow[];
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-popover px-3 py-2 text-xs whitespace-nowrap text-popover-foreground shadow-lift"
      style={{ left, top }}
    >
      <p className="text-muted-foreground">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="text-sm font-semibold tabular-nums">{row.value}</span>
            <span className="text-muted-foreground">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
