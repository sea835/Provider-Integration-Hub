import type { ReactNode } from "react";
import { StatCard, type Stat } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  stats?: Stat[];
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, stats, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-5", className)}>
      <div className="text-hero-foreground md:pr-32">
        {eyebrow ? <p className="mb-1.5 text-xs font-medium text-hero-muted">{eyebrow}</p> : null}
        <h1
          className="font-display text-[28px] leading-[1.15] font-bold sm:text-[34px] lg:text-[38px]"
          suppressHydrationWarning
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed font-semibold text-white/90">{description}</p>
        ) : null}
        {actions ? <div className="mt-3.5 flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {stats && stats.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      ) : null}
    </header>
  );
}
