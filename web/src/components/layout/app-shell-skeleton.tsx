import { Skeleton } from "@/components/ui/skeleton";
import { BrandMark } from "./brand";

export function AppShellSkeleton() {
  return (
    <div
      className="min-h-dvh md:grid md:grid-cols-[216px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]"
      aria-busy="true"
      aria-label="Đang tải phiên làm việc"
    >
      <aside className="hidden h-dvh flex-col gap-5 p-4 md:flex">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-1.5 pt-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      </aside>
      <div className="flex flex-col">
        <div className="flex h-14 items-center justify-end px-4 sm:px-6">
          <Skeleton className="size-9" />
        </div>
        <div className="space-y-6 px-4 pt-2 sm:px-6 lg:px-8">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-28 rounded-lg" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <Skeleton className="h-72 rounded-lg" />
            <Skeleton className="h-72 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
