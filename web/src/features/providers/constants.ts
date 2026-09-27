import { Blocks, Building2, CreditCard, MessageSquareText, Truck, Users2, type LucideIcon } from "lucide-react";
import type { BadgeTone } from "@/components/ui/badge";
import type {
  ProviderAuthType,
  ProviderCategory,
  ProviderLogStatus,
  ProviderLogType,
  ProviderStatus,
  SyncStatus,
} from "./types";

export const CATEGORY_META: Record<ProviderCategory, { label: string; icon: LucideIcon }> = {
  CRM: { label: "CRM", icon: Users2 },
  ERP: { label: "ERP", icon: Building2 },
  LOGISTICS: { label: "Kho vận", icon: Truck },
  PAYMENT: { label: "Thanh toán", icon: CreditCard },
  MESSAGING: { label: "Tin nhắn", icon: MessageSquareText },
  OTHER: { label: "Khác", icon: Blocks },
};

export const STATUS_META: Record<ProviderStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: "Hoạt động", tone: "success" },
  INACTIVE: { label: "Tạm dừng", tone: "neutral" },
  ERROR: { label: "Lỗi kết nối", tone: "danger" },
};

export const AUTH_TYPE_META: Record<ProviderAuthType, { label: string; description: string }> = {
  API_KEY: { label: "API Key", description: "Khóa truy cập gửi kèm mỗi request" },
  OAUTH2: { label: "OAuth 2.0", description: "Client credentials: client ID và client secret" },
  BASIC: { label: "Basic Auth", description: "Tên đăng nhập và mật khẩu" },
};

export const SYNC_STATUS_META: Record<SyncStatus, { label: string; tone: BadgeTone }> = {
  SUCCESS: { label: "Thành công", tone: "success" },
  FAILED: { label: "Thất bại", tone: "danger" },
  RUNNING: { label: "Đang đồng bộ", tone: "info" },
  NEVER: { label: "Chưa đồng bộ", tone: "neutral" },
};

export const LOG_TYPE_META: Record<ProviderLogType, { label: string }> = {
  SYNC: { label: "Đồng bộ" },
  CONNECTION_TEST: { label: "Kiểm tra kết nối" },
  CONFIG_UPDATE: { label: "Cập nhật cấu hình" },
};

export const LOG_STATUS_META: Record<ProviderLogStatus, { label: string; tone: BadgeTone }> = {
  SUCCESS: { label: "Thành công", tone: "success" },
  FAILED: { label: "Thất bại", tone: "danger" },
  RUNNING: { label: "Đang chạy", tone: "info" },
};

export const SYNC_INTERVAL_OPTIONS = [
  { value: 0, label: "Chỉ thủ công" },
  { value: 15, label: "Mỗi 15 phút" },
  { value: 30, label: "Mỗi 30 phút" },
  { value: 60, label: "Mỗi giờ" },
  { value: 360, label: "Mỗi 6 giờ" },
  { value: 1440, label: "Mỗi ngày" },
];

export function syncIntervalLabel(minutes: number): string {
  return SYNC_INTERVAL_OPTIONS.find((option) => option.value === minutes)?.label ?? `Mỗi ${minutes} phút`;
}
