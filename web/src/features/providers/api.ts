import { api } from "@/lib/api/client";
import type {
  BalanceCheck,
  BalanceSeries,
  Paginated,
  CallKind,
  Provider,
  ProviderConfig,
  ProviderSamples,
  ProviderStatus,
  SecretsPatch,
  SeriesRange,
  TestConnectionResult,
} from "./types";

export interface CreateProviderInput {
  code: string;
  name: string;
  intervalMinutes: number;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  cooldownMinutes: number;
}

export interface UpdateProviderInput {
  name?: string;
  status?: ProviderStatus;
  intervalMinutes?: number;
  warningThreshold?: number | null;
  criticalThreshold?: number | null;
  cooldownMinutes?: number;
}

export interface ProviderConfigInput {
  config: ProviderConfig;
  secrets: SecretsPatch;
  unitMultiplier: number;
}

export interface HistoryFilter {
  providerId?: string;
  status?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

export function fetchProviders(signal?: AbortSignal): Promise<Provider[]> {
  return api.get<Provider[]>("/admin/providers", { signal });
}

export function fetchProvider(id: string, signal?: AbortSignal): Promise<Provider> {
  return api.get<Provider>(`/admin/providers/${id}`, { signal });
}

export function createProvider(input: CreateProviderInput): Promise<Provider> {
  return api.post<Provider>("/admin/providers", input);
}

export function updateProvider(id: string, input: UpdateProviderInput): Promise<Provider> {
  return api.patch<Provider>(`/admin/providers/${id}`, input);
}

export function updateProviderConfig(id: string, input: ProviderConfigInput): Promise<Provider> {
  return api.put<Provider>(`/admin/providers/${id}/config`, input);
}

export function deleteProvider(id: string): Promise<unknown> {
  return api.delete<unknown>(`/admin/providers/${id}`);
}

export function checkProviderNow(id: string): Promise<BalanceCheck> {
  return api.post<BalanceCheck>(`/admin/providers/${id}/check`);
}

export function testConnection(
  input: ProviderConfigInput & { providerId?: string; scope?: CallKind },
): Promise<TestConnectionResult> {
  return api.post<TestConnectionResult>("/admin/providers/test-connection", input);
}

export function saveProviderSamples(id: string, samples: ProviderSamples): Promise<Provider> {
  return api.put<Provider>(`/admin/providers/${id}/samples`, samples);
}

export function fetchHistory(filter: HistoryFilter, signal?: AbortSignal): Promise<Paginated<BalanceCheck>> {
  return api.get<Paginated<BalanceCheck>>("/admin/balance-checks", { query: { ...filter }, signal });
}

export function fetchSeries(range: SeriesRange, providerIds: string[], signal?: AbortSignal): Promise<BalanceSeries[]> {
  return api.get<BalanceSeries[]>("/admin/balance-checks/series", {
    query: { range, providerIds: providerIds.join(",") },
    signal,
  });
}
