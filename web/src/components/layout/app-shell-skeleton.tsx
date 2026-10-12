import { cn } from "@/lib/utils";
import { BrandMark } from "./brand";

function GlassBlock({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-white/15", className)} />;
}

export function AppShellSkeleton() {
  return (
    <div className="min-h-dvh md:p-3 lg:p-4" aria-busy="true" aria-label="Đang tải phiên làm việc">
      <div className="glass-frame min-h-dvh md:grid md:min-h-[calc(100dvh-1.5rem)] md:grid-cols-[192px_minmax(0,1fr)] md:gap-4 md:rounded-3xl md:p-4 lg:min-h-[calc(100dvh-2rem)] lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-5 lg:rounded-[28px] lg:p-5">
        <aside className="sidebar-surface hidden h-[calc(100dvh-3.5rem)] flex-col items-center gap-7 rounded-[20px] py-6 md:flex lg:h-[calc(100dvh-4.5rem)]">
          <BrandMark className="size-14" />
          <div className="w-full space-y-2 px-4">
            {Array.from({ length: 3 }, (_, index) => (
              <GlassBlock key={index} className="h-10 rounded-lg" />
            ))}
          </div>
        </aside>
        <div className="space-y-5 px-4 pt-5 md:px-0.5 md:pt-0.5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <GlassBlock className="h-10 w-72 max-w-full" />
              <GlassBlock className="h-4 w-56" />
            </div>
            <GlassBlock className="size-10 rounded-full" />
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_288px]">
            <GlassBlock className="h-80" />
            <div className="grid gap-4">
              <GlassBlock className="h-36" />
              <GlassBlock className="h-36" />
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <GlassBlock className="h-64" />
            <GlassBlock className="h-64" />
            <GlassBlock className="h-64" />
          </div>
        </div>
      </div>
    </div>
  );
}
