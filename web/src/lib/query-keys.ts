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
  },
  alertChannels: {
    telegram: ["alert-channels", "telegram"] as const,
  },
  balanceChecks: {
    all: ["balance-checks"] as const,
    history: (filter: Record<string, string | number | undefined>) => ["balance-checks", "history", filter] as const,
    series: (range: string, providerIds: string[]) => ["balance-checks", "series", range, providerIds] as const,
  },
};
