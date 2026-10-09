import { initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-primary-soft text-primary",
  "bg-secondary text-secondary-foreground",
  "bg-[oklch(0.92_0.02_15)] text-[oklch(0.4_0.05_15)] dark:bg-[oklch(0.3_0.03_15)] dark:text-[oklch(0.88_0.03_15)]",
  "bg-hero text-hero-foreground",
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
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tracking-wide select-none",
        PALETTE[hashOf(name) % PALETTE.length],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
