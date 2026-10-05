import { api } from "@/lib/api/client";
import type { Paginated } from "@/features/suppliers/types";
import type {
  CallbackTestResult,
  CreateMerchantInput,
  Merchant,
  MerchantWithCallbackSecret,
  MerchantWithKey,
  StoreCallback,
  UpdateMerchantInput,
} from "./types";

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

export async function fetchMerchants(signal?: AbortSignal): Promise<Merchant[]> {
  const merchants: Merchant[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const batch = await api.get<Paginated<Merchant>>("/admin/merchants", {
      query: { page, limit: PAGE_SIZE },
      signal,
    });
    merchants.push(...batch.data);
    if (page >= batch.meta.totalPages) break;
  }
  return merchants;
}

export function fetchMerchant(id: string, signal?: AbortSignal): Promise<Merchant> {
  return api.get<Merchant>(`/admin/merchants/${id}`, { signal });
}

export function createMerchant(input: CreateMerchantInput): Promise<MerchantWithKey> {
  return api.post<MerchantWithKey>("/admin/merchants", input);
}

export function updateMerchant(id: string, input: UpdateMerchantInput): Promise<Merchant> {
  return api.patch<Merchant>(`/admin/merchants/${id}`, input);
}

export function rotateMerchantKey(id: string): Promise<MerchantWithKey> {
  return api.post<MerchantWithKey>(`/admin/merchants/${id}/rotate-key`);
}

export function rotateCallbackSecret(id: string): Promise<MerchantWithCallbackSecret> {
  return api.post<MerchantWithCallbackSecret>(`/admin/merchants/${id}/callback-secret`);
}

export function testMerchantCallback(id: string): Promise<CallbackTestResult> {
  return api.post<CallbackTestResult>(`/admin/merchants/${id}/callback-test`);
}

export function fetchMerchantCallbacks(id: string, signal?: AbortSignal): Promise<StoreCallback[]> {
  return api.get<StoreCallback[]>(`/admin/merchants/${id}/callbacks`, { query: { limit: 20 }, signal });
}

export function fetchOrderCallbacks(transCode: string, signal?: AbortSignal): Promise<StoreCallback[]> {
  return api.get<StoreCallback[]>(`/admin/orders/${transCode}/callbacks`, { signal });
}

export function retryStoreCallback(id: string): Promise<StoreCallback> {
  return api.post<StoreCallback>(`/admin/store-callbacks/${id}/retry`);
}
