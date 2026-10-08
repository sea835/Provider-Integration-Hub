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
  suppliers: {
    balance: (id: string) => ["suppliers", "balance", id] as const,
    all: ["suppliers"] as const,
    list: ["suppliers", "list"] as const,
    detail: (id: string) => ["suppliers", "detail", id] as const,
    adapterTypes: ["suppliers", "adapter-types"] as const,
  },
  merchants: {
    all: ["merchants"] as const,
    list: ["merchants", "list"] as const,
    detail: (id: string) => ["merchants", "detail", id] as const,
    callbacks: (id: string) => ["merchants", "callbacks", id] as const,
  },
  orders: {
    all: ["orders"] as const,
    list: (filter: { supplierCode?: string; merchantId?: string; status?: string; limit?: number }) =>
      [
        "orders",
        "list",
        filter.supplierCode ?? "",
        filter.merchantId ?? "",
        filter.status ?? "",
        filter.limit ?? 20,
      ] as const,
    detail: (transCode: string) => ["orders", "detail", transCode] as const,
    events: (transCode: string) => ["orders", "events", transCode] as const,
    callbacks: (transCode: string) => ["orders", "callbacks", transCode] as const,
  },
};
