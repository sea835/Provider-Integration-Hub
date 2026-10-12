import type { BadgeTone } from "@/components/ui/badge";
import type { AlertLevel, CheckStatus, Provider, ProviderStatus } from "./types";

export const INTERVAL_OPTIONS = [5, 15, 30, 60] as const;

export const LEVEL_META: Record<AlertLevel, { label: string; tone: BadgeTone }> = {
  OK: { label: "An toàn", tone: "success" },
  WARNING: { label: "Sắp hết", tone: "warning" },
  CRITICAL: { label: "Khẩn cấp", tone: "danger" },
};

export const STATUS_META: Record<ProviderStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: "Đang quét", tone: "primary" },
  PAUSED: { label: "Tạm dừng", tone: "neutral" },
};

export const CHECK_META: Record<CheckStatus, { label: string; tone: BadgeTone }> = {
  SUCCESS: { label: "Thành công", tone: "success" },
  FAILED: { label: "Thất bại", tone: "danger" },
};

export const RANGE_OPTIONS = [
  { value: "5m", label: "5 phút" },
  { value: "15m", label: "15 phút" },
  { value: "30m", label: "30 phút" },
  { value: "60m", label: "60 phút" },
  { value: "3h", label: "3 giờ" },
  { value: "12h", label: "12 giờ" },
  { value: "24h", label: "24 giờ" },
  { value: "7d", label: "7 ngày" },
  { value: "30d", label: "30 ngày" },
] as const;

export const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

export function intervalLabel(minutes: number): string {
  return minutes >= 60 ? `${minutes / 60} giờ` : `${minutes} phút`;
}

export function balanceTone(provider: Provider): BadgeTone {
  return provider.currentBalance === null ? "neutral" : LEVEL_META[provider.level].tone;
}
