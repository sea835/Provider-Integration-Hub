import { initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-primary-soft text-primary",
  "bg-success-soft text-success",
  "bg-[#fde7f1] text-[#b02a6b] dark:bg-[#4a1f3d] dark:text-[#f6a5cb]",
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
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-wide select-none",
        PALETTE[hashOf(name) % PALETTE.length],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
