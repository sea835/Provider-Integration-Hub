import type { BadgeTone } from "@/components/ui/badge";
import { SYSTEM_ROLES, type SystemRole } from "@/lib/api/types";

export const ROLE_META: Record<SystemRole, { label: string; description: string; tone: BadgeTone }> = {
  ADMIN: {
    label: "Quản trị viên",
    description: "Toàn quyền hệ thống, bao gồm quản lý người dùng và phân quyền.",
    tone: "primary",
  },
  MANAGER: {
    label: "Quản lý",
    description: "Quản lý nghiệp vụ theo bộ quyền được gán cho vai trò.",
    tone: "outline",
  },
  USER: {
    label: "Người dùng",
    description: "Quyền cơ bản, chủ yếu xem và cập nhật thông tin của chính mình.",
    tone: "neutral",
  },
};

export const ROLE_OPTIONS = SYSTEM_ROLES.map((value) => ({ value, ...ROLE_META[value] }));

export function roleMeta(role: string) {
  return ROLE_META[role as SystemRole] ?? { label: role, description: "", tone: "outline" as BadgeTone };
}

export const ACTIVE_STATUS = "ACTIVE";
export const LOCKED_STATUS = "LOCKED";

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: "Hoạt động", tone: "success" },
  LOCKED: { label: "Đã khóa", tone: "danger" },
  INACTIVE: { label: "Vô hiệu", tone: "neutral" },
  SUSPENDED: { label: "Tạm ngưng", tone: "warning" },
};

export function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, tone: "outline" as BadgeTone };
}

export const STATUS_FILTERS = [
  { value: "all", label: "Mọi trạng thái" },
  { value: "active", label: "Đang hoạt động" },
  { value: "inactive", label: "Bị khóa / vô hiệu" },
] as const;
