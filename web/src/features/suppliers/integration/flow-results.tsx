"use client";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import type { PackageCheck, SupplierOrderSummary, SupplierPackage, BalanceView } from "../api";

export const ORDER_OUTCOME_META: Record<string, { label: string; tone: BadgeTone }> = {
  SUCCESS: { label: "Thành công", tone: "success" },
  FAILED: { label: "Thất bại", tone: "danger" },
  PENDING: { label: "Đang xử lý", tone: "info" },
  UNKNOWN: { label: "Chưa rõ", tone: "warning" },
  NOT_FOUND: { label: "Không có", tone: "neutral" },
};

export function PackagesTable({ packages }: { packages: SupplierPackage[] }) {
  if (packages.length === 0) {
    return <p className="text-[12.5px] text-muted-foreground">Không đọc được gói nào.</p>;
  }
  return (
    <div className="max-h-72 scrollbar-thin overflow-auto rounded-md border">
      <table className="w-full text-left text-[12.5px]">
        <thead className="sticky top-0 bg-subtle text-[11.5px] text-muted-foreground uppercase">
          <tr>
            <th className="px-2.5 py-1.5 font-medium">Mã gói</th>
            <th className="px-2.5 py-1.5 font-medium">Tên</th>
            <th className="px-2.5 py-1.5 text-right font-medium">Giá</th>
          </tr>
        </thead>
        <tbody>
          {packages.map((item) => (
            <tr key={item.code} className="border-t align-top">
              <td className="px-2.5 py-1.5 font-mono break-all">{item.code}</td>
              <td className="px-2.5 py-1.5">
                {item.name}
                {item.description ? (
                  <span className="block text-[11.5px] text-muted-foreground">{item.description}</span>
                ) : null}
              </td>
              <td className="px-2.5 py-1.5 text-right font-mono whitespace-nowrap">
                {item.price === null ? "—" : formatNumber(item.price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CheckVerdict({ check }: { check: PackageCheck }) {
  const meta =
    check.eligible === true
      ? { label: "Đăng ký được", tone: "success" as const }
      : check.eligible === false
        ? { label: "Không đăng ký được", tone: "danger" as const }
        : { label: "Chưa rõ, Hub vẫn gửi đơn", tone: "warning" as const };
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
      <Badge tone={meta.tone}>{meta.label}</Badge>
      {check.reason ? (
        <>
          <span className="font-mono text-danger">{check.reason.code}</span>
          <span>{check.reason.message}</span>
        </>
      ) : null}
    </div>
  );
}

function money(value: number | null, currency: string | null): string {
  if (value === null) return "—";
  return `${value.toLocaleString("vi-VN")}${currency ? ` ${currency}` : ""}`;
}

export function BalanceVerdict({ balance }: { balance: BalanceView }) {
  const meta =
    balance.sufficient === true
      ? { label: "Đủ số dư", tone: "success" as const }
      : balance.sufficient === false
        ? { label: "Không đủ số dư", tone: "danger" as const }
        : { label: "Chưa rõ, Hub vẫn gửi đơn", tone: "warning" as const };
  return (
    <div className="grid gap-1.5 text-[12.5px]">
      <Badge tone={meta.tone} className="justify-self-start">
        {meta.label}
      </Badge>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-muted-foreground">Khả dụng</dt>
        <dd className="font-mono">{money(balance.available, balance.currency)}</dd>
        <dt className="text-muted-foreground">Tạm giữ</dt>
        <dd className="font-mono">{money(balance.pending, balance.currency)}</dd>
        <dt className="text-muted-foreground">Tối thiểu để gửi đơn</dt>
        <dd className="font-mono">
          {balance.minimum === null ? "lớn hơn 0" : money(balance.minimum, balance.currency)}
        </dd>
      </dl>
    </div>
  );
}

export function OrdersTable({ orders }: { orders: SupplierOrderSummary[] }) {
  if (orders.length === 0) {
    return <p className="text-[12.5px] text-muted-foreground">Không có đơn nào trong khoảng này.</p>;
  }
  return (
    <div className="max-h-80 scrollbar-thin overflow-auto rounded-md border">
      <table className="w-full text-left text-[12.5px]">
        <thead className="sticky top-0 bg-subtle text-[11.5px] text-muted-foreground uppercase">
          <tr>
            <th className="px-2.5 py-1.5 font-medium">Mã đơn Hub</th>
            <th className="px-2.5 py-1.5 font-medium">Mã NCC</th>
            <th className="px-2.5 py-1.5 font-medium">Trạng thái NCC</th>
            <th className="px-2.5 py-1.5 font-medium">Hub hiểu là</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, index) => {
            const meta = ORDER_OUTCOME_META[order.outcome] ?? { label: order.outcome, tone: "outline" as const };
            return (
              <tr key={`${order.transCode ?? "?"}-${order.supplierTransId ?? index}`} className="border-t align-top">
                <td className="px-2.5 py-1.5 font-mono break-all">{order.transCode ?? "—"}</td>
                <td className="px-2.5 py-1.5 font-mono break-all">{order.supplierTransId ?? "—"}</td>
                <td className="px-2.5 py-1.5 font-mono">
                  {order.status ?? "—"}
                  {order.createdAt ? (
                    <span className="block text-[11px] text-muted-foreground">{order.createdAt}</span>
                  ) : null}
                </td>
                <td className="px-2.5 py-1.5">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  {order.errorCode ? (
                    <span className="mt-0.5 block font-mono text-[11px] text-danger">{order.errorCode}</span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
