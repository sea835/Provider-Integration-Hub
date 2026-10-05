import type { BadgeTone } from "@/components/ui/badge";
import type { OrderStatus, SupplierStatus, SupplierTuning } from "./types";

export const SUPPLIER_STATUS_META: Record<SupplierStatus, { label: string; tone: BadgeTone; description: string }> = {
  ACTIVE: { label: "Đang chạy", tone: "success", description: "Nhận đơn mới và gửi sang nhà cung cấp" },
  PAUSED: { label: "Tạm dừng", tone: "warning", description: "Không nhận đơn mới; đơn đang dở chờ bật lại" },
  DISABLED: { label: "Ngừng hẳn", tone: "neutral", description: "Không nhận đơn, không xử lý đơn đang dở" },
};

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Chờ gửi", tone: "neutral" },
  PROCESSING: { label: "Đang xử lý", tone: "info" },
  COMPLETED: { label: "Thành công", tone: "success" },
  FAILED: { label: "Thất bại", tone: "danger" },
  MANUAL_REVIEW: { label: "Cần đối soát", tone: "warning" },
  CANCELLED: { label: "Đã huỷ", tone: "neutral" },
};

export const ACTION_LABELS: Record<string, string> = {
  BUY_DATA: "Mua gói data",
  TOPUP: "Nạp tiền",
  ACTIVATE_SIM: "Kích hoạt SIM",
  CANCEL_PACKAGE: "Huỷ gói",
};

export const EVENT_SOURCE_LABELS: Record<string, string> = {
  API: "Store gửi",
  SUBMIT: "Gửi đơn",
  CHECK: "Tra cứu",
  CALLBACK: "Callback",
  OPERATOR: "Vận hành",
  SWEEPER: "Tự phục hồi",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  ACCEPTED: "Nhận đơn",
  SUBMIT_STARTED: "Bắt đầu gửi",
  RESULT: "Kết quả",
  RESUBMIT_REQUESTED: "Gửi lại",
  MANUAL_REVIEW: "Chuyển đối soát",
  RECHECK_REQUESTED: "Cho tra cứu lại",
  CONFLICT: "Mâu thuẫn",
};

export const DEFAULT_TUNING: SupplierTuning = {
  submitTimeoutMs: 30000,
  queryTimeoutMs: 10000,
  concurrency: 5,
  rateLimitPerMin: 60,
  pollScheduleSec: [5, 10, 20, 40, 60, 120, 300, 900, 1800, 3600],
  maxWaitSec: 86400,
  maxResubmit: 2,
  callbackIpWhitelist: [],
};

export const HUB_PUBLIC_URL = (process.env.NEXT_PUBLIC_HUB_PUBLIC_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export function callbackUrlOf(code: string): string {
  return `${HUB_PUBLIC_URL}/v1/callbacks/${code}`;
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
