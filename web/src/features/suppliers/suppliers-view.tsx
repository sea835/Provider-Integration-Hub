"use client";

import { CheckCircle2, CirclePause, CircleSlash, PlugZap, Plus, RefreshCw, Search, X } from "lucide-react";
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
import { SUPPLIER_STATUS_META } from "./constants";
import { CreateSupplierDialog } from "./create-supplier-dialog";
import { useAdapterTypes, useSuppliers } from "./hooks";
import { AdapterBadge, SupplierStatusBadge } from "./supplier-visuals";
import { SUPPLIER_STATUSES } from "./types";

export function SuppliersView() {
  const router = useRouter();
  const suppliers = useSuppliers();
  const adapters = useAdapterTypes();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const term = useDeferredValue(search.trim().toLowerCase());

  const adapterLabel = (type: string) => adapters.data?.find((item) => item.type === type)?.label ?? type;

  const list = useMemo(() => suppliers.data ?? [], [suppliers.data]);
  const stats = useMemo(
    () => ({
      total: list.length,
      active: list.filter((item) => item.status === "ACTIVE").length,
      paused: list.filter((item) => item.status === "PAUSED").length,
      disabled: list.filter((item) => item.status === "DISABLED").length,
    }),
    [list],
  );

  const filtered = useMemo(
    () =>
      list.filter((item) => {
        if (status !== "all" && item.status !== status) return false;
        if (!term) return true;
        return [item.name, item.code, item.baseUrl].some((value) => value.toLowerCase().includes(term));
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
        title="Nhà cung cấp"
        description="Kết nối Hub với API của từng nhà cung cấp. Thêm, thử kết nối và bật tắt hoàn toàn trên giao diện, không cần deploy."
        actions={
          <>
            <Hint label="Tải lại">
              <Button
                variant="outline"
                size="icon"
                onClick={() => void suppliers.refetch()}
                aria-label="Tải lại danh sách"
              >
                <RefreshCw className={cn(suppliers.isFetching && "animate-spin")} aria-hidden />
              </Button>
            </Hint>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              Thêm nhà cung cấp
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatTile
          label="Tổng nhà cung cấp"
          value={formatNumber(stats.total)}
          icon={PlugZap}
          loading={suppliers.isPending}
        />
        <StatTile
          label="Đang chạy"
          value={formatNumber(stats.active)}
          icon={CheckCircle2}
          tone="success"
          loading={suppliers.isPending}
        />
        <StatTile
          label="Tạm dừng"
          value={formatNumber(stats.paused)}
          icon={CirclePause}
          tone="warning"
          loading={suppliers.isPending}
        />
        <StatTile
          label="Ngừng hẳn"
          value={formatNumber(stats.disabled)}
          icon={CircleSlash}
          tone="neutral"
          loading={suppliers.isPending}
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
            placeholder="Tìm theo tên, mã hoặc địa chỉ API…"
            aria-label="Tìm nhà cung cấp"
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
            {SUPPLIER_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {SUPPLIER_STATUS_META[value].label}
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
        {suppliers.isPending ? (
          <div className="space-y-2 p-5" aria-hidden>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : suppliers.isError ? (
          <ErrorState error={suppliers.error} onRetry={() => void suppliers.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={PlugZap}
            title={hasFilters ? "Không có nhà cung cấp phù hợp" : "Chưa có nhà cung cấp nào"}
            description={
              hasFilters ? "Thử bỏ bớt điều kiện lọc." : "Thêm nhà cung cấp đầu tiên để Store bắt đầu gửi đơn."
            }
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              ) : (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus aria-hidden />
                  Thêm nhà cung cấp
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhà cung cấp</TableHead>
                <TableHead>Loại kết nối</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Địa chỉ API</TableHead>
                <TableHead className="text-right">Cập nhật</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => router.push(`/suppliers/${item.id}`)}>
                  <TableCell>
                    <Link
                      href={`/suppliers/${item.id}`}
                      className="font-medium hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {item.name}
                    </Link>
                    <span className="block font-mono text-[12px] text-muted-foreground">{item.code}</span>
                  </TableCell>
                  <TableCell>
                    <AdapterBadge label={adapterLabel(item.adapterType)} />
                  </TableCell>
                  <TableCell>
                    <SupplierStatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="max-w-72">
                    <span className="block truncate font-mono text-[12.5px]" title={item.baseUrl}>
                      {item.baseUrl}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-[12.5px] whitespace-nowrap text-muted-foreground">
                    <time dateTime={item.updatedAt} title={formatDateTime(item.updatedAt)}>
                      {formatRelative(item.updatedAt)}
                    </time>
                    <span className="block font-mono text-[11.5px]">v{item.version}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <CreateSupplierDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
