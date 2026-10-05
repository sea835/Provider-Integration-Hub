import { Badge, StatusDot } from "@/components/ui/badge";
import { ORDER_STATUS_META, SUPPLIER_STATUS_META } from "./constants";
import type { OrderStatus, SupplierStatus } from "./types";

export function SupplierStatusBadge({ status }: { status: SupplierStatus }) {
  const meta = SUPPLIER_STATUS_META[status];
  return (
    <Badge tone={meta.tone}>
      <StatusDot tone={meta.tone} pulse={status === "ACTIVE"} />
      {meta.label}
    </Badge>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_META[status] ?? { label: status, tone: "outline" as const };
  return (
    <Badge tone={meta.tone}>
      <StatusDot tone={meta.tone} pulse={status === "PROCESSING" || status === "PENDING"} />
      {meta.label}
    </Badge>
  );
}

export function AdapterBadge({ label }: { label: string }) {
  return <Badge tone="primary">{label}</Badge>;
}
