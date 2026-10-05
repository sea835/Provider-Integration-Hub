"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  createMerchant,
  fetchMerchant,
  fetchMerchantCallbacks,
  fetchMerchants,
  fetchOrderCallbacks,
  retryStoreCallback,
  rotateCallbackSecret,
  rotateMerchantKey,
  testMerchantCallback,
  updateMerchant,
} from "./api";
import type {
  Merchant,
  MerchantWithCallbackSecret,
  MerchantWithKey,
  StoreCallback,
  UpdateMerchantInput,
} from "./types";

const LIVE_CALLBACK_REFRESH_MS = 3000;

function withoutKey({ apiKey: _apiKey, ...merchant }: MerchantWithKey): Merchant {
  return merchant;
}

export function useMerchants() {
  return useQuery({
    queryKey: queryKeys.merchants.list,
    queryFn: ({ signal }) => fetchMerchants(signal),
  });
}

export function useMerchant(id: string) {
  return useQuery({
    queryKey: queryKeys.merchants.detail(id),
    queryFn: ({ signal }) => fetchMerchant(id, signal),
  });
}

export function useCreateMerchant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMerchant,
    onSuccess: (merchant) => {
      queryClient.setQueryData(queryKeys.merchants.detail(merchant.id), withoutKey(merchant));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.merchants.list }),
  });
}

function useStoreMerchant(id: string) {
  const queryClient = useQueryClient();
  return (merchant: Merchant) => {
    queryClient.setQueryData(queryKeys.merchants.detail(id), merchant);
    queryClient.setQueryData<Merchant[]>(queryKeys.merchants.list, (current) =>
      current?.map((item) => (item.id === id ? merchant : item)),
    );
  };
}

export function useUpdateMerchant(id: string) {
  const queryClient = useQueryClient();
  const store = useStoreMerchant(id);
  return useMutation({
    mutationFn: (input: UpdateMerchantInput) => updateMerchant(id, input),
    onSuccess: store,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.merchants.list }),
  });
}

export function useRotateMerchantKey(id: string) {
  const queryClient = useQueryClient();
  const store = useStoreMerchant(id);
  return useMutation({
    mutationFn: () => rotateMerchantKey(id),
    onSuccess: (merchant) => store(withoutKey(merchant)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.merchants.list }),
  });
}

function withoutSecret({ callbackSecret: _secret, ...merchant }: MerchantWithCallbackSecret): Merchant {
  return merchant;
}

export function useRotateCallbackSecret(id: string) {
  const store = useStoreMerchant(id);
  return useMutation({
    mutationFn: () => rotateCallbackSecret(id),
    onSuccess: (merchant) => store(withoutSecret(merchant)),
  });
}

export function useTestMerchantCallback(id: string) {
  return useMutation({ mutationFn: () => testMerchantCallback(id) });
}

function hasPending(callbacks: StoreCallback[] | undefined): boolean {
  return callbacks?.some((callback) => callback.status === "PENDING") ?? false;
}

export function useMerchantCallbacks(id: string) {
  return useQuery({
    queryKey: queryKeys.merchants.callbacks(id),
    queryFn: ({ signal }) => fetchMerchantCallbacks(id, signal),
    refetchInterval: (query) => (hasPending(query.state.data) ? LIVE_CALLBACK_REFRESH_MS : false),
  });
}

export function useOrderCallbacks(transCode: string | null, live = false) {
  return useQuery({
    queryKey: queryKeys.orders.callbacks(transCode ?? ""),
    queryFn: ({ signal }) => fetchOrderCallbacks(transCode ?? "", signal),
    enabled: transCode !== null,
    refetchInterval: (query) => (live || hasPending(query.state.data) ? LIVE_CALLBACK_REFRESH_MS : false),
  });
}

export function useRetryStoreCallback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: retryStoreCallback,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.merchants.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
}
