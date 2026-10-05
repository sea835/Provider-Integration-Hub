"use client";

import { Inbox, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { actionLabel, ORDER_STATUS_META } from "./constants";
import { useOrders } from "./hooks";
import { OrderEventsSheet } from "./order-events-sheet";
import { OrderStatusBadge } from "./supplier-visuals";
import { ORDER_STATUSES, type AdminOrder, type OrderStatus } from "./types";

export function SupplierOrders({ supplierCode }: { supplierCode: string }) {
  return (
    <OrdersPanel
      filter={{ supplierCode }}
      title="Đơn gửi tới nhà cung cấp này"
      emptyDescription="Đơn Store gửi với supplierCode của nhà cung cấp này sẽ hiện ở đây."
    />
  );
}

export function OrdersPanel({
  filter,
  title,
  emptyDescription,
  showSupplier = false,
}: {
  filter: { supplierCode?: string; merchantId?: string };
  title: string;
  emptyDescription: string;
  showSupplier?: boolean;
}) {
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const orders = useOrders({ ...filter, status: status === "all" ? undefined : status, limit: 50 });
  const list = orders.data?.data ?? [];
  const live = list.some((order) => order.status === "PENDING" || order.status === "PROCESSING");
  const current = selected ? (list.find((order) => order.transCode === selected.transCode) ?? selected) : null;

  return (
    <div>
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {live
              ? "Đang tự làm mới mỗi 3 giây vì còn đơn chưa có kết quả."
              : "50 đơn mới nhất. Bấm vào đơn để xem từng lần Hub gọi nhà cung cấp."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(value) => setStatus(value as OrderStatus | "all")}>
            <SelectTrigger className="w-44" aria-label="Lọc theo trạng thái đơn">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi trạng thái</SelectItem>
              {ORDER_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {ORDER_STATUS_META[value].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void orders.refetch()}
            aria-label="Tải lại danh sách đơn"
          >
            <RefreshCw className={cn(orders.isFetching && "animate-spin")} aria-hidden />
          </Button>
        </div>
      </div>

      {orders.isPending ? (
        <div className="space-y-2 p-5" aria-hidden>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={Inbox} title="Chưa có đơn nào" description={emptyDescription} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Đơn</TableHead>
              {showSupplier ? <TableHead>Nhà cung cấp</TableHead> : null}
              <TableHead>Thao tác</TableHead>
              <TableHead>Thuê bao / serial</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Lỗi</TableHead>
              <TableHead className="text-right">Tạo lúc</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((order) => (
              <TableRow key={order.id} className="cursor-pointer" onClick={() => setSelected(order)}>
                <TableCell>
                  <button
                    type="button"
                    className="text-left font-mono text-[12.5px] hover:underline"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelected(order);
                    }}
                  >
                    {order.transCode}
                  </button>
                  <span className="block font-mono text-[11.5px] text-muted-foreground">{order.requestId}</span>
                </TableCell>
                {showSupplier ? <TableCell className="font-mono text-[12.5px]">{order.supplierCode}</TableCell> : null}
                <TableCell>
                  <span className="block text-[13px]">{actionLabel(order.action)}</span>
                  <span className="block font-mono text-[11.5px] text-muted-foreground">{order.packageCode}</span>
                </TableCell>
                <TableCell className="font-mono text-[12.5px]">{order.phone ?? order.serial ?? "—"}</TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell className="max-w-56">
                  {order.errorCode ? (
                    <span
                      className="block truncate font-mono text-[12px] text-danger"
                      title={order.errorMessage ?? order.errorCode}
                    >
                      {order.errorCode}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-[12.5px] whitespace-nowrap text-muted-foreground">
                  <time dateTime={order.createdAt} title={formatDateTime(order.createdAt)}>
                    {formatRelative(order.createdAt)}
                  </time>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <OrderEventsSheet order={current} onClose={() => setSelected(null)} />
    </div>
  );
}
