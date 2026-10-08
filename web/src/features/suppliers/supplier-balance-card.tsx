"use client";

import { RefreshCw, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { useSupplierBalance } from "./hooks";

function money(value: number | null, currency: string | null): string {
  if (value === null) return "—";
  return `${value.toLocaleString("vi-VN")}${currency ? ` ${currency}` : ""}`;
}

export function SupplierBalanceCard({ supplierId }: { supplierId: string }) {
  const balance = useSupplierBalance(supplierId);
  const data = balance.data;
  const meta =
    data?.sufficient === true
      ? { label: "Đủ để gửi đơn", tone: "success" as const }
      : data?.sufficient === false
        ? { label: "Dưới mức tối thiểu", tone: "danger" as const }
        : { label: "Chưa rõ", tone: "warning" as const };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-4 text-primary" aria-hidden />
            Số dư tại nhà cung cấp
          </CardTitle>
          <CardDescription>Số dư tài khoản đại lý, hỏi thật nhà cung cấp bằng cấu hình đang lưu.</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void balance.refetch()}
          isLoading={balance.isFetching}
          aria-label="Hỏi lại số dư"
        >
          {balance.isFetching ? null : <RefreshCw aria-hidden />}
          Làm mới
        </Button>
      </CardHeader>
      <CardContent>
        {balance.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : balance.isError ? (
          <ErrorState error={balance.error} onRetry={() => void balance.refetch()} className="py-6" />
        ) : data && !data.supported ? (
          <p className="text-[13px] text-muted-foreground">{data.message}</p>
        ) : data ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-2xl font-semibold tracking-tight">
                {money(data.available, data.currency)}
              </span>
              <Badge tone={meta.tone}>{meta.label}</Badge>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
              <dt className="text-muted-foreground">Đang tạm giữ</dt>
              <dd className="font-mono">{money(data.pending, data.currency)}</dd>
              <dt className="text-muted-foreground">Tối thiểu để gửi đơn</dt>
              <dd className="font-mono">{data.minimum === null ? "lớn hơn 0" : money(data.minimum, data.currency)}</dd>
              <dt className="text-muted-foreground">Hỏi lúc</dt>
              <dd>
                {formatDateTime(data.checkedAt)} · {data.durationMs} ms
              </dd>
            </dl>
            {!data.ok ? <p className="text-[13px] text-danger">{data.message}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
