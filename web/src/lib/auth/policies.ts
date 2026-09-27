export type PolicyAction = "manage" | "create" | "read" | "update" | "delete";

export type Policy = readonly [PolicyAction, string];

export const POLICIES = {
  users: {
    view: ["manage", "User"] as Policy,
    create: ["create", "User"] as Policy,
    update: ["update", "User"] as Policy,
    remove: ["delete", "User"] as Policy,
  },
  access: {
    manage: ["manage", "all"] as Policy,
  },
  providers: {
    view: ["read", "Provider"] as Policy,
    create: ["create", "Provider"] as Policy,
    update: ["update", "Provider"] as Policy,
    remove: ["delete", "Provider"] as Policy,
    sync: ["update", "Provider"] as Policy,
    test: ["read", "Provider"] as Policy,
  },
} as const;

export const STANDARD_ACTIONS: PolicyAction[] = ["manage", "create", "read", "update", "delete"];

export const ACTION_LABELS: Record<string, string> = {
  manage: "Toàn quyền",
  create: "Tạo",
  read: "Xem",
  update: "Sửa",
  delete: "Xóa",
};

export const SUBJECT_LABELS: Record<string, string> = {
  all: "Mọi tài nguyên",
  User: "Người dùng",
  Provider: "Nhà cung cấp",
  Role: "Vai trò",
  Permission: "Quyền hạn",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function subjectLabel(subject: string): string {
  return SUBJECT_LABELS[subject] ?? subject;
}
