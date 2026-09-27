import { Skeleton } from "@/components/ui/skeleton";
import { BrandMark } from "./brand";

export function AppShellSkeleton() {
  return (
    <div
      className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]"
      aria-busy="true"
      aria-label="Đang tải phiên làm việc"
    >
      <aside className="hidden h-dvh flex-col gap-6 border-r border-sidebar-border bg-sidebar p-5 lg:flex">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-2 pt-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      </aside>
      <div className="flex flex-col">
        <div className="flex h-16 items-center justify-between border-b px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-4 w-36" />
          <div className="flex items-center gap-2">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="hidden h-9 w-40 md:block" />
          </div>
        </div>
        <div className="space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
