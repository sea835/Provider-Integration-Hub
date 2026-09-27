export const queryKeys = {
  session: ["session"] as const,
  health: ["system", "health"] as const,
  users: {
    all: ["users"] as const,
    list: ["users", "list"] as const,
  },
  roles: {
    all: ["roles"] as const,
    list: ["roles", "list"] as const,
    permissions: (roleId: string) => ["roles", "permissions", roleId] as const,
  },
  permissions: {
    list: ["permissions", "list"] as const,
  },
  providers: {
    all: ["providers"] as const,
    list: ["providers", "list"] as const,
    detail: (id: string) => ["providers", "detail", id] as const,
    logs: (id: string) => ["providers", "logs", id] as const,
    activity: ["providers", "activity"] as const,
  },
};
