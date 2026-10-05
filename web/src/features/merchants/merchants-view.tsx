"use client";

import { CheckCircle2, Lock, Plus, RefreshCw, Search, Store, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Hint } from "@/components/ui/tooltip";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApiKeyDialog } from "./api-key-dialog";
import { MERCHANT_STATUS_META } from "./constants";
import { CreateMerchantDialog } from "./create-merchant-dialog";
import { useMerchants } from "./hooks";
import { MaskedKey, MerchantStatusBadge } from "./merchant-visuals";
import { MERCHANT_STATUSES, type MerchantWithKey } from "./types";

export function MerchantsView() {
  const router = useRouter();
  const merchants = useMerchants();
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<MerchantWithKey | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const term = useDeferredValue(search.trim().toLowerCase());

  const list = useMemo(() => merchants.data ?? [], [merchants.data]);
  const stats = useMemo(
    () => ({
      total: list.length,
      active: list.filter((item) => item.status === "ACTIVE").length,
      inactive: list.filter((item) => item.status === "INACTIVE").length,
    }),
    [list],
  );
  const filtered = useMemo(
    () =>
      list.filter((item) => {
        if (status !== "all" && item.status !== status) return false;
        if (!term) return true;
        return [item.name, item.code].some((value) => value.toLowerCase().includes(term));
      }),
    [list, status, term],
  );

  const hasFilters = search !== "" || status !== "all";
  const clearFilters = () => {
    setSearch("");
    setStatus("all");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store"
        description="Hệ thống bán hàng gọi Hub để lấy gói, kiểm tra gói và gửi đơn. Mỗi Store có một API key riêng."
        actions={
          <>
            <Hint label="Tải lại">
              <Button
                variant="outline"
                size="icon"
                onClick={() => void merchants.refetch()}
                aria-label="Tải lại danh sách"
              >
                <RefreshCw className={cn(merchants.isFetching && "animate-spin")} aria-hidden />
              </Button>
            </Hint>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              Thêm Store
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
        <StatTile label="Tổng Store" value={formatNumber(stats.total)} icon={Store} loading={merchants.isPending} />
        <StatTile
          label="Đang hoạt động"
          value={formatNumber(stats.active)}
          icon={CheckCircle2}
          tone="success"
          loading={merchants.isPending}
        />
        <StatTile
          label="Tạm khoá"
          value={formatNumber(stats.inactive)}
          icon={Lock}
          tone="neutral"
          loading={merchants.isPending}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên hoặc mã…"
            aria-label="Tìm Store"
            className="pl-9"
            autoComplete="off"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48" aria-label="Lọc theo trạng thái">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi trạng thái</SelectItem>
            {MERCHANT_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {MERCHANT_STATUS_META[value].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="self-start sm:self-auto">
            <X aria-hidden />
            Xóa bộ lọc
          </Button>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        {merchants.isPending ? (
          <div className="space-y-2 p-5" aria-hidden>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : merchants.isError ? (
          <ErrorState error={merchants.error} onRetry={() => void merchants.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Store}
            title={hasFilters ? "Không có Store phù hợp" : "Chưa có Store nào"}
            description={
              hasFilters ? "Thử bỏ bớt điều kiện lọc." : "Thêm Store đầu tiên để nhận API key và bắt đầu gửi đơn."
            }
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              ) : (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus aria-hidden />
                  Thêm Store
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>API key</TableHead>
                <TableHead>IP được phép</TableHead>
                <TableHead className="text-right">Cập nhật</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => router.push(`/merchants/${item.id}`)}>
                  <TableCell>
                    <Link
                      href={`/merchants/${item.id}`}
                      className="font-medium hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {item.name}
                    </Link>
                    <span className="block font-mono text-[12px] text-muted-foreground">{item.code}</span>
                  </TableCell>
                  <TableCell>
                    <MerchantStatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>
                    <MaskedKey last4={item.apiKeyLast4} />
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {item.ipWhitelist.length === 0 ? (
                      <span className="text-warning">Mọi IP</span>
                    ) : (
                      <span className="font-mono text-[12.5px]" title={item.ipWhitelist.join(", ")}>
                        {item.ipWhitelist[0]}
                        {item.ipWhitelist.length > 1 ? ` +${item.ipWhitelist.length - 1}` : ""}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-[12.5px] whitespace-nowrap text-muted-foreground">
                    <time dateTime={item.updatedAt} title={formatDateTime(item.updatedAt)}>
                      {formatRelative(item.updatedAt)}
                    </time>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <CreateMerchantDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={setCreated} />
      <ApiKeyDialog
        merchant={created}
        reason="created"
        onClose={() => {
          const id = created?.id;
          setCreated(null);
          if (id) router.push(`/merchants/${id}`);
        }}
      />
    </div>
  );
}
