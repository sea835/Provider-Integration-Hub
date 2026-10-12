"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import {
  checkProviderNow,
  createProvider,
  deleteProvider,
  fetchHistory,
  fetchProvider,
  fetchProviders,
  fetchSeries,
  saveProviderSamples,
  testConnection,
  updateProvider,
  updateProviderConfig,
  type HistoryFilter,
  type ProviderConfigInput,
  type UpdateProviderInput,
} from "./api";
import type { Provider, ProviderSamples, SeriesRange } from "./types";

const LIVE_REFRESH_MS = 60_000;

export function useProviders(enabled = true) {
  return useQuery({
    queryKey: queryKeys.providers.list,
    queryFn: ({ signal }) => fetchProviders(signal),
    refetchInterval: LIVE_REFRESH_MS,
    enabled,
  });
}

export function useProvider(id: string) {
  return useQuery({
    queryKey: queryKeys.providers.detail(id),
    queryFn: ({ signal }) => fetchProvider(id, signal),
  });
}

export function useHistory(filter: HistoryFilter) {
  return useQuery({
    queryKey: queryKeys.balanceChecks.history({ ...filter }),
    queryFn: ({ signal }) => fetchHistory(filter, signal),
    placeholderData: keepPreviousData,
  });
}

export function useSeries(range: SeriesRange, providerIds: string[], enabled = true) {
  return useQuery({
    queryKey: queryKeys.balanceChecks.series(range, providerIds),
    queryFn: ({ signal }) => fetchSeries(range, providerIds, signal),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_REFRESH_MS,
    enabled: enabled && providerIds.length > 0,
  });
}

function useStoreProvider() {
  const queryClient = useQueryClient();
  return (provider: Provider) => {
    queryClient.setQueryData<Provider>(queryKeys.providers.detail(provider.id), provider);
    queryClient.setQueryData<Provider[]>(queryKeys.providers.list, (current) =>
      current
        ? current.some((item) => item.id === provider.id)
          ? current.map((item) => (item.id === provider.id ? provider : item))
          : [...current, provider]
        : current,
    );
  };
}

export function useCreateProvider() {
  const store = useStoreProvider();
  return useMutation({ mutationFn: createProvider, onSuccess: store });
}

export function useUpdateProvider() {
  const store = useStoreProvider();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProviderInput; notice?: string }) =>
      updateProvider(id, input),
    onSuccess: (provider, { notice }) => {
      store(provider);
      if (notice) toast.success(notice, { description: provider.name });
    },
  });
}

export function useUpdateProviderConfig() {
  const store = useStoreProvider();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProviderConfigInput }) => updateProviderConfig(id, input),
    onSuccess: store,
  });
}

export function useSaveSamples() {
  const store = useStoreProvider();
  return useMutation({
    mutationFn: ({ id, samples }: { id: string; samples: ProviderSamples }) => saveProviderSamples(id, samples),
    onSuccess: store,
  });
}

export function useDeleteProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: Provider) => deleteProvider(provider.id),
    onSuccess: (_result, provider) => {
      queryClient.setQueryData<Provider[]>(queryKeys.providers.list, (current) =>
        current?.filter((item) => item.id !== provider.id),
      );
      queryClient.removeQueries({ queryKey: queryKeys.providers.detail(provider.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.balanceChecks.all });
      toast.success("Đã xóa đối tác", { description: provider.name });
    },
  });
}

export function useCheckNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: Provider) => checkProviderNow(provider.id),
    onSuccess: (check, provider) => {
      if (check.status === "SUCCESS") {
        toast.success(`Số dư ${provider.name}: ${formatMoney(check.balance)}`);
      } else {
        toast.error(`Kiểm tra ${provider.name} thất bại`, { description: check.errorMessage ?? undefined });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.providers.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.balanceChecks.all });
    },
  });
}

export function useTestConnection() {
  return useMutation({ mutationFn: testConnection, meta: { silent: true } });
}
