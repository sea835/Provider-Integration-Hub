import { api } from "@/lib/api/client";
import type { ConnectionTestResult, Provider, ProviderLog, ProviderRepository } from "./types";

export const httpProviderRepository: ProviderRepository = {
  list: () => api.get<Provider[]>("/providers"),
  get: (id) => api.get<Provider>(`/providers/${id}`),
  create: (input) => api.post<Provider>("/providers", input),
  update: (id, input) => api.patch<Provider>(`/providers/${id}`, input),
  remove: async (id) => {
    await api.delete<unknown>(`/providers/${id}`);
  },
  testConnection: (id) => api.post<ConnectionTestResult>(`/providers/${id}/test-connection`),
  triggerSync: (id) => api.post<ProviderLog>(`/providers/${id}/sync`),
  logs: (id, limit = 50) => api.get<ProviderLog[]>(`/providers/${id}/logs`, { query: { limit } }),
  recentActivity: (limit = 12) => api.get<ProviderLog[]>("/providers/logs", { query: { limit } }),
};
