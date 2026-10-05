"use client";

import { useMutation } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/api/errors";
import { fetchSupplierOrders } from "./api";
import { OrdersTable } from "./integration/flow-results";
import { toIntegrationParams } from "./integration/state";
import type { Supplier } from "./types";

function localInput(ms: number): string {
  return new Date(ms - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function SupplierNccOrders({ supplier }: { supplier: Supplier }) {
  const [from, setFrom] = useState(() => localInput(Date.now() - 86_400_000));
  const [to, setTo] = useState(() => localInput(Date.now()));
  const notConfigured =
    supplier.adapterType === "HTTP_CONFIG" && !toIntegrationParams(supplier.params).spec.orders.enabled;

  const load = useMutation({
    mutationFn: () =>
      fetchSupplierOrders(supplier.id, {
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      }),
  });
  const data = load.data;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Đơn phía nhà cung cấp</CardTitle>
          <CardDescription>
            Gọi API danh sách đơn (API 5) của nhà cung cấp để xem đơn bên họ và cách Hub hiểu từng đơn. Tối đa 31 ngày.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4">
        {notConfigured ? (
          <p className="rounded-lg border bg-subtle p-3 text-[13px] text-muted-foreground">
            Nhà cung cấp này chưa khai báo API 5 (danh sách đơn). Bật ở tab Tích hợp → Các API.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-[12px] text-muted-foreground">
                Từ
                <Input
                  type="datetime-local"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="h-8 font-mono text-[13px]"
                />
              </label>
              <label className="grid gap-1 text-[12px] text-muted-foreground">
                Đến
                <Input
                  type="datetime-local"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="h-8 font-mono text-[13px]"
                />
              </label>
              <Button size="sm" variant="outline" onClick={() => load.mutate()} isLoading={load.isPending}>
                {load.isPending ? null : <RefreshCw aria-hidden />}
                Tải đơn
              </Button>
            </div>
            {load.isError ? <p className="text-[12.5px] text-danger">{getErrorMessage(load.error)}</p> : null}
            {data ? (
              data.ok ? (
                <div className="grid gap-2" aria-live="polite">
                  <p className="text-[12.5px] text-muted-foreground">
                    {data.orders.length} đơn · {data.durationMs} ms
                  </p>
                  <OrdersTable orders={data.orders} />
                </div>
              ) : (
                <p
                  className={
                    data.supported
                      ? "rounded-md bg-danger-soft px-3 py-2 text-[12.5px] text-danger"
                      : "rounded-lg border bg-subtle p-3 text-[13px] text-muted-foreground"
                  }
                  aria-live="polite"
                >
                  {data.message}
                </p>
              )
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
