import type { BadgeTone } from "@/components/ui/badge";
import type { MerchantStatus } from "./types";

export const MERCHANT_STATUS_META: Record<MerchantStatus, { label: string; tone: BadgeTone; description: string }> = {
  ACTIVE: { label: "Đang hoạt động", tone: "success", description: "Store gọi Hub được bằng API key hiện tại" },
  INACTIVE: { label: "Tạm khoá", tone: "neutral", description: "Hub từ chối mọi lời gọi của Store này" },
};

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-fA-F:]+$/;

export function parseIpList(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function invalidIps(ips: string[]): string[] {
  return ips.filter((ip) => !IPV4.test(ip) && !(ip.includes(":") && IPV6.test(ip)));
}
