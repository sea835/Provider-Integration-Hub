import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7 shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="7" className="fill-hero" />
      <path
        d="M16 16 9.5 10M16 16l6.5-6M16 16v8"
        className="stroke-hero-foreground"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <circle cx="16" cy="16" r="3.4" className="fill-primary-soft" />
      <circle cx="9.5" cy="10" r="2" className="fill-hero-foreground" />
      <circle cx="22.5" cy="10" r="2" className="fill-hero-foreground" />
      <circle cx="16" cy="24" r="2" className="fill-hero-foreground" />
    </svg>
  );
}

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <div className="leading-tight">
        <p className="font-display text-[16px] font-extrabold">Provider Hub</p>
        {compact ? null : <p className="text-xs text-muted-foreground">Integration console</p>}
      </div>
    </div>
  );
}
