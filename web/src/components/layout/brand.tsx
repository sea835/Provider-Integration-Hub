import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M16 16 9.5 10M16 16l6.5-6M16 16v8"
        className="stroke-primary-foreground"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.75"
      />
      <circle cx="16" cy="16" r="3.4" className="fill-primary-foreground" />
      <circle cx="9.5" cy="10" r="2" className="fill-primary-foreground" />
      <circle cx="22.5" cy="10" r="2" className="fill-primary-foreground" />
      <circle cx="16" cy="24" r="2" className="fill-primary-foreground" />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <div className="leading-tight">
        <p className="text-[15px] font-semibold tracking-tight">Provider Hub</p>
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Integration console</p>
      </div>
    </div>
  );
}
