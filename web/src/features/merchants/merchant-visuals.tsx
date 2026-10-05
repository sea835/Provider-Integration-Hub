import { Badge, StatusDot } from "@/components/ui/badge";
import { MERCHANT_STATUS_META } from "./constants";
import type { MerchantStatus } from "./types";

export function MerchantStatusBadge({ status }: { status: MerchantStatus }) {
  const meta = MERCHANT_STATUS_META[status];
  return (
    <Badge tone={meta.tone}>
      <StatusDot tone={meta.tone} pulse={status === "ACTIVE"} />
      {meta.label}
    </Badge>
  );
}

export function MaskedKey({ last4 }: { last4: string }) {
  return <span className="font-mono text-[12.5px] tracking-wide">••••••••{last4}</span>;
}
