"use client";

import { RefreshCw, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { actionLabel, EVENT_SOURCE_LABELS, EVENT_TYPE_LABELS, ORDER_STATUS_META } from "./constants";
import { useOrderCallbacks } from "@/features/merchants/hooks";
import { StoreCallbackList } from "@/features/merchants/store-callback-list";
import { useCheckOrderNow, useOrderDetail, useOrderEvents } from "./hooks";
import { DeliveryList, OrderReconcilePanel } from "./order-reconcile-panel";
import { OrderStatusBadge } from "./supplier-visuals";
import type { AdminOrder, OrderEvent, OrderStatus } from "./types";

function statusLabel(value: string | null): string {
  if (!value) return "";
  return ORDER_STATUS_META[value as OrderStatus]?.label ?? value;
}

function Json({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <details className="group rounded-md border bg-subtle">
      <summary className="cursor-pointer px-3 py-1.5 text-[12px] font-medium text-muted-foreground select-none hover:text-foreground">
        {label}
      </summary>
      <pre className="max-h-64 scrollbar-thin overflow-auto border-t px-3 py-2 font-mono text-[11.5px] leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function EventItem({ event }: { event: OrderEvent }) {
  const tone =
    event.type === "CONFLICT" || event.type === "MANUAL_REVIEW"
      ? "warning"
      : event.outcome === "SUCCESS"
        ? "success"
        : event.outcome === "FAILED"
          ? "danger"
          : "neutral";
  return (
    <li className="relative pl-6">
      <span
        aria-hidden
        className={cn(
          "absolute top-1.5 left-0 size-[11px] rounded-full border-2 border-popover",
          tone === "success"
            ? "bg-success"
            : tone === "danger"
              ? "bg-danger"
              : tone === "warning"
                ? "bg-warning"
                : "bg-info",
        )}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{EVENT_TYPE_LABELS[event.type] ?? event.type}</span>
        <Badge tone="outline">{EVENT_SOURCE_LABELS[event.source] ?? event.source}</Badge>
        {event.outcome ? <Badge tone={tone}>{event.outcome}</Badge> : null}
        {event.httpStatus ? (
          <span className="font-mono text-[11.5px] text-muted-foreground">HTTP {event.httpStatus}</span>
        ) : null}
        {event.durationMs !== null ? (
          <span className="font-mono text-[11.5px] text-muted-foreground">{event.durationMs} ms</span>
        ) : null}
      </div>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
        {event.fromStatus && event.toStatus && event.fromStatus !== event.toStatus
          ? ` · ${statusLabel(event.fromStatus)} → ${statusLabel(event.toStatus)}`
          : ""}
      </p>
      {event.message ? <p className="mt-1 text-[13px] break-words">{event.message}</p> : null}
      <div className="mt-2 grid gap-1.5">
        <Json label="Request gửi nhà cung cấp" value={event.request} />
        <Json label="Phản hồi của nhà cung cấp" value={event.response} />
      </div>
    </li>
  );
}

export function OrderEventsSheet({ order: selected, onClose }: { order: AdminOrder | null; onClose: () => void }) {
  const detail = useOrderDetail(selected);
  const order = selected && detail.data?.transCode === selected.transCode ? detail.data : selected;
  const live = order?.status === "PENDING" || order?.status === "PROCESSING";
  const events = useOrderEvents(order?.transCode ?? null, live);
  const callbacks = useOrderCallbacks(order?.transCode ?? null);
  const finished = order?.status === "COMPLETED" || order?.status === "FAILED" || order?.status === "CANCELLED";
  const checkNow = useCheckOrderNow();

  const recheck = () => {
    if (!order) return;
    checkNow.mutate(order.transCode, {
      onSuccess: () => {
        toast.success("Đã yêu cầu tra cứu lại", { description: order.transCode });
        void events.refetch();
      },
      onError: (error) => toast.error("Không tra cứu lại được", { description: getErrorMessage(error) }),
    });
  };

  return (
    <DialogPrimitive.Root open={selected !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-[min(40rem,100vw)] flex-col border-l bg-popover shadow-lift duration-300 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right">
          {order ? (
            <>
              <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
                <div className="min-w-0 space-y-1.5">
                  <DialogPrimitive.Title className="flex flex-wrap items-center gap-2 text-base font-semibold">
                    <span className="font-mono text-[14px] break-all">{order.transCode}</span>
                    <OrderStatusBadge status={order.status} />
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-[13px] text-muted-foreground">
                    {actionLabel(order.action)} · gói <span className="font-mono">{order.packageCode}</span>
                    {order.phone ? ` · ${order.phone}` : ""}
                    {order.serial ? ` · serial ${order.serial}` : ""} · mã Store{" "}
                    <span className="font-mono">{order.requestId}</span>
                  </DialogPrimitive.Description>
                  {order.errorCode ? (
                    <p className="text-[13px] text-danger">
                      <span className="font-mono">{order.errorCode}</span>
                      {order.errorMessage ? `: ${order.errorMessage}` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {order.status === "PROCESSING" ? (
                    <Button variant="outline" size="sm" onClick={recheck} isLoading={checkNow.isPending}>
                      {checkNow.isPending ? null : <RefreshCw aria-hidden />}
                      Tra cứu ngay
                    </Button>
                  ) : null}
                  <DialogPrimitive.Close
                    className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Đóng"
                  >
                    <X className="size-4" aria-hidden />
                  </DialogPrimitive.Close>
                </div>
              </div>
              <div className="flex-1 scrollbar-thin overflow-y-auto px-5 py-4">
                {order.status === "COMPLETED" ? (
                  <div className="mb-4 grid gap-2 rounded-xl border p-4">
                    <h3 className="text-sm font-semibold">Kết quả đã giao</h3>
                    <DeliveryList supplierTransId={order.supplierTransId} delivery={order.delivery} />
                  </div>
                ) : null}
                <div className="mb-6">
                  <OrderReconcilePanel key={order.transCode} order={order} />
                </div>
                {finished || (callbacks.data?.length ?? 0) > 0 ? (
                  <section className="mb-6 grid gap-3 rounded-xl border p-4" aria-labelledby="order-store-callbacks">
                    <h3 id="order-store-callbacks" className="text-sm font-semibold">
                      Báo kết quả về Store
                    </h3>
                    <StoreCallbackList
                      callbacks={callbacks.data}
                      isPending={callbacks.isPending}
                      error={callbacks.isError ? callbacks.error : null}
                      onRetry={() => void callbacks.refetch()}
                      emptyText="Đơn này chưa có lần báo nào."
                    />
                  </section>
                ) : null}
                <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Lịch sử xử lý · gửi {order.submitCount} lần · tra cứu {order.checkCount} lần
                </p>
                {events.isPending ? (
                  <div className="space-y-4" aria-hidden>
                    {Array.from({ length: 4 }, (_, index) => (
                      <Skeleton key={index} className="h-14 w-full" />
                    ))}
                  </div>
                ) : events.isError ? (
                  <ErrorState error={events.error} onRetry={() => void events.refetch()} className="py-6" />
                ) : (
                  <ol className="relative space-y-5 before:absolute before:inset-y-1 before:left-[5px] before:w-px before:bg-border">
                    {(events.data ?? []).map((event) => (
                      <EventItem key={event.id} event={event} />
                    ))}
                  </ol>
                )}
              </div>
            </>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
