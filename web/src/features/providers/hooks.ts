"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { queryKeys } from "@/lib/query-keys";
import { providerRepository } from "./repository";
import type { Provider, ProviderInput, ProviderLog, ProviderUpdateInput } from "./types";

const RUNNING_POLL_MS = 2000;

function hasRunningSync(providers: Provider[] | undefined): boolean {
  return Boolean(providers?.some((provider) => provider.lastSyncStatus === "RUNNING"));
}

function hasRunningLog(logs: ProviderLog[] | undefined): boolean {
  return Boolean(logs?.some((log) => log.status === "RUNNING"));
}

export function useProviders(enabled = true) {
  return useQuery({
    queryKey: queryKeys.providers.list,
    queryFn: () => providerRepository.list(),
    enabled,
    refetchInterval: (query) => (hasRunningSync(query.state.data) ? RUNNING_POLL_MS : false),
  });
}

export function useProvider(id: string) {
  return useQuery({
    queryKey: queryKeys.providers.detail(id),
    queryFn: () => providerRepository.get(id),
    refetchInterval: (query) => (query.state.data?.lastSyncStatus === "RUNNING" ? RUNNING_POLL_MS : false),
  });
}

export function useProviderLogs(id: string, limit = 50) {
  return useQuery({
    queryKey: [...queryKeys.providers.logs(id), limit],
    queryFn: () => providerRepository.logs(id, limit),
    refetchInterval: (query) => (hasRunningLog(query.state.data) ? RUNNING_POLL_MS : false),
  });
}

export function useProviderActivity(limit = 12, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.providers.activity, limit],
    queryFn: () => providerRepository.recentActivity(limit),
    enabled,
    refetchInterval: (query) => (hasRunningLog(query.state.data) ? RUNNING_POLL_MS : 60_000),
  });
}

export function useCreateProvider() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (input: ProviderInput) => providerRepository.create(input, user.email),
    onSuccess: (provider) => {
      queryClient.setQueryData<Provider[]>(queryKeys.providers.list, (current) =>
        current ? [...current, provider] : [provider],
      );
      queryClient.setQueryData(queryKeys.providers.detail(provider.id), provider);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.providers.all }),
  });
}

export function useUpdateProvider(id: string) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (input: ProviderUpdateInput) => providerRepository.update(id, input, user.email),
    onSuccess: (provider) => {
      queryClient.setQueryData(queryKeys.providers.detail(id), provider);
      queryClient.setQueryData<Provider[]>(queryKeys.providers.list, (current) =>
        current?.map((item) => (item.id === id ? provider : item)),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.providers.all }),
  });
}

export function useDeleteProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => providerRepository.remove(id),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<Provider[]>(queryKeys.providers.list, (current) =>
        current?.filter((item) => item.id !== id),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.providers.list });
      void queryClient.invalidateQueries({ queryKey: queryKeys.providers.activity });
    },
  });
}

export function useTestConnection() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (id: string) => providerRepository.testConnection(id, user.email),
    meta: { silent: true },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.providers.all }),
  });
}

export function useTriggerSync() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (id: string) => providerRepository.triggerSync(id, user.email),
    onSuccess: (_log, id) => {
      const markRunning = (provider: Provider) =>
        provider.id === id
          ? { ...provider, lastSyncStatus: "RUNNING" as const, lastSyncMessage: "Đang đồng bộ dữ liệu…" }
          : provider;
      queryClient.setQueryData<Provider>(queryKeys.providers.detail(id), (current) =>
        current ? markRunning(current) : current,
      );
      queryClient.setQueryData<Provider[]>(queryKeys.providers.list, (current) => current?.map(markRunning));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.providers.all }),
  });
}
