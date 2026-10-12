"use client";

import { ArrowRight, PlugsConnected } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BalanceText, LastCheck, LevelBadge } from "@/features/providers/provider-visuals";
import type { Provider } from "@/features/providers/types";
import { cn } from "@/lib/utils";

const RANK: Record<Provider["level"], number> = { CRITICAL: 0, WARNING: 1, OK: 2 };

export function ProviderStatusCard({
  providers,
  isPending,
  className,
}: {
  providers: Provider[] | undefined;
  isPending: boolean;
  className?: string;
}) {
  const rows = [...(providers ?? [])].sort(
    (a, b) =>
      Number(b.connectionFailing) - Number(a.connectionFailing) ||
      RANK[a.level] - RANK[b.level] ||
      a.name.localeCompare(b.name, "vi"),
  );

  return (
    <Card className={cn("min-w-0 p-4 sm:p-5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base leading-tight font-semibold tracking-tight">Số dư theo đối tác</h2>
        <Link
          href="/providers"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
        >
          Quản lý
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      <div className="mt-3">
        {isPending ? (
          <div className="space-y-1.5" aria-hidden>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={PlugsConnected}
            title="Chưa có đối tác nào"
            description="Thêm đối tác ở trang Đối tác để bắt đầu giám sát số dư."
            className="py-8"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Đối tác</TableHead>
                <TableHead className="text-right">Số dư</TableHead>
                <TableHead>Mức</TableHead>
                <TableHead className="hidden sm:table-cell">Kiểm tra gần nhất</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell className="w-full max-w-0">
                    <Link
                      href={`/providers/${provider.id}`}
                      className="block truncate font-medium hover:text-primary hover:underline"
                      title={provider.name}
                    >
                      {provider.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <BalanceText provider={provider} />
                  </TableCell>
                  <TableCell>
                    <LevelBadge provider={provider} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <LastCheck provider={provider} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Card>
  );
}
