"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  checkOrderNow,
  createSupplier,
  fetchAdapterTypes,
  fetchOrder,
  fetchOrderEvents,
  fetchOrders,
  fetchSupplier,
  fetchSuppliers,
  lookupOrder,
  recheckOrder,
  resolveOrder,
  testSupplierConnection,
  updateSupplier,
  type OrderFilter,
} from "./api";
import type { AdminOrder, ResolveOrderInput, Supplier, UpdateSupplierInput } from "./types";

const LIVE_ORDER_REFRESH_MS = 3000;

export function useSuppliers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.suppliers.list,
    queryFn: ({ signal }) => fetchSuppliers(signal),
    enabled,
  });
}

export function useSupplier(id: string) {
  return useQuery({
    queryKey: queryKeys.suppliers.detail(id),
    queryFn: ({ signal }) => fetchSupplier(id, signal),
  });
}

export function useAdapterTypes() {
  return useQuery({
    queryKey: queryKeys.suppliers.adapterTypes,
    queryFn: ({ signal }) => fetchAdapterTypes(signal),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSupplier,
    onSuccess: (supplier) => {
      queryClient.setQueryData(queryKeys.suppliers.detail(supplier.id), supplier);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.list }),
  });
}

export function useUpdateSupplier(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSupplierInput) => updateSupplier(id, input),
    onSuccess: (supplier) => {
      queryClient.setQueryData(queryKeys.suppliers.detail(id), supplier);
      queryClient.setQueryData<Supplier[]>(queryKeys.suppliers.list, (current) =>
        current?.map((item) => (item.id === id ? supplier : item)),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.list }),
  });
}

export function useTestConnection(id: string) {
  return useMutation({ mutationFn: () => testSupplierConnection(id) });
}

export function useOrders(filter: OrderFilter, enabled = true) {
  return useQuery({
    queryKey: queryKeys.orders.list(filter),
    queryFn: ({ signal }) => fetchOrders(filter, signal),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.data.some((order) => order.status === "PENDING" || order.status === "PROCESSING")
        ? LIVE_ORDER_REFRESH_MS
        : false,
  });
}

function isLive(order: AdminOrder | null | undefined): boolean {
  return order?.status === "PENDING" || order?.status === "PROCESSING";
}

export function useOrderDetail(order: AdminOrder | null) {
  return useQuery({
    queryKey: queryKeys.orders.detail(order?.transCode ?? ""),
    queryFn: ({ signal }) => fetchOrder(order?.transCode ?? "", signal),
    enabled: order !== null,
    initialData: order ?? undefined,
    initialDataUpdatedAt: 0,
    refetchInterval: (query) => (isLive(query.state.data) ? LIVE_ORDER_REFRESH_MS : false),
  });
}

export function useOrderEvents(transCode: string | null, live = false) {
  return useQuery({
    queryKey: queryKeys.orders.events(transCode ?? ""),
    queryFn: ({ signal }) => fetchOrderEvents(transCode ?? "", signal),
    enabled: transCode !== null,
    refetchInterval: live ? LIVE_ORDER_REFRESH_MS : false,
  });
}

export function useCheckOrderNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: checkOrderNow,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
  });
}

export function useLookupOrder() {
  return useMutation({ mutationFn: lookupOrder });
}

export function useResolveOrder(transCode: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResolveOrderInput) => resolveOrder(transCode, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
  });
}

export function useRecheckOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transCode: string) => recheckOrder(transCode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
  });
}
