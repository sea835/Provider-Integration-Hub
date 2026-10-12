import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-9 shrink-0", className)} aria-hidden>
      <circle cx="24" cy="24" r="24" fill="#ffffff" />
      <path
        d="M24 24 14.5 15.5M24 24l9.5-8.5M24 24v12"
        stroke="#4318c4"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="14.5" cy="15.5" r="3.4" fill="#4318c4" />
      <circle cx="33.5" cy="15.5" r="3.4" fill="#4318c4" />
      <circle cx="24" cy="36" r="3.4" fill="#4318c4" />
      <circle cx="24" cy="24" r="5.4" fill="#2fa822" stroke="#ffffff" strokeWidth="2" />
    </svg>
  );
}

export function Brand({ className, stacked = false }: { className?: string; stacked?: boolean }) {
  if (stacked) {
    return (
      <div className={cn("flex flex-col items-center gap-2 text-hero-foreground", className)}>
        <BrandMark className="size-12" />
        <p className="text-[13px] leading-none font-bold tracking-tight">Provider Hub</p>
      </div>
    );
  }
  return (
    <div className={cn("flex items-center gap-2.5 text-hero-foreground", className)}>
      <BrandMark />
      <p className="font-display text-[17px] leading-none font-bold">Provider Hub</p>
    </div>
  );
}
