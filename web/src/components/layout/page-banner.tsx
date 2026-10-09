import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface BannerStat {
  label: string;
  value: ReactNode;
}

interface PageBannerProps {
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  stats?: BannerStat[];
  actions?: ReactNode;
  className?: string;
}

export function PageBanner({ eyebrow, title, description, stats, actions, className }: PageBannerProps) {
  return (
    <header
      className={cn(
        "hero-glow flex flex-col gap-6 rounded-xl bg-hero px-5 py-6 text-hero-foreground sm:px-7 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow ? <p className="text-xs font-medium text-hero-muted">{eyebrow}</p> : null}
        <h1 className="font-display text-[28px] leading-tight font-extrabold sm:text-[32px]" suppressHydrationWarning>
          {title}
        </h1>
        {description ? <p className="max-w-[60ch] text-sm text-hero-muted">{description}</p> : null}
        {actions ? <div className="flex flex-wrap items-center gap-2 pt-2">{actions}</div> : null}
      </div>
      {stats && stats.length > 0 ? (
        <dl className="grid shrink-0 grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-x-7 gap-y-4 sm:flex sm:gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse gap-1">
              <dt className="text-xs text-hero-muted">{stat.label}</dt>
              <dd className="font-display text-[30px] leading-none font-extrabold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}
