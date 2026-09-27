import { initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-[oklch(0.9_0.05_192)] text-[oklch(0.38_0.08_192)] dark:bg-[oklch(0.35_0.06_192)] dark:text-[oklch(0.9_0.06_192)]",
  "bg-[oklch(0.9_0.05_250)] text-[oklch(0.4_0.1_250)] dark:bg-[oklch(0.35_0.07_250)] dark:text-[oklch(0.9_0.05_250)]",
  "bg-[oklch(0.92_0.05_75)] text-[oklch(0.45_0.1_60)] dark:bg-[oklch(0.38_0.06_70)] dark:text-[oklch(0.92_0.06_80)]",
  "bg-[oklch(0.91_0.05_330)] text-[oklch(0.42_0.1_330)] dark:bg-[oklch(0.36_0.07_330)] dark:text-[oklch(0.9_0.05_330)]",
  "bg-[oklch(0.91_0.05_150)] text-[oklch(0.4_0.09_155)] dark:bg-[oklch(0.35_0.06_155)] dark:text-[oklch(0.9_0.06_155)]",
];

function hashOf(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-wide select-none",
        PALETTE[hashOf(name) % PALETTE.length],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
