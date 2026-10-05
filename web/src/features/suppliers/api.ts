import { api } from "@/lib/api/client";
import type {
  AdapterType,
  AdminOrder,
  ConnectionTestResult,
  CreateSupplierInput,
  OrderEvent,
  OrderLookup,
  OrderStatus,
  Paginated,
  ResolveOrderInput,
  Supplier,
  UpdateSupplierInput,
} from "./types";

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

export async function fetchSuppliers(signal?: AbortSignal): Promise<Supplier[]> {
  const suppliers: Supplier[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const batch = await api.get<Paginated<Supplier>>("/admin/suppliers", {
      query: { page, limit: PAGE_SIZE },
      signal,
    });
    suppliers.push(...batch.data);
    if (page >= batch.meta.totalPages) break;
  }
  return suppliers;
}

export function fetchSupplier(id: string, signal?: AbortSignal): Promise<Supplier> {
  return api.get<Supplier>(`/admin/suppliers/${id}`, { signal });
}

export function fetchAdapterTypes(signal?: AbortSignal): Promise<AdapterType[]> {
  return api.get<AdapterType[]>("/admin/suppliers/adapter-types", { signal });
}

export function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  return api.post<Supplier>("/admin/suppliers", input);
}

export function updateSupplier(id: string, input: UpdateSupplierInput): Promise<Supplier> {
  return api.patch<Supplier>(`/admin/suppliers/${id}`, input);
}

export function testSupplierConnection(id: string): Promise<ConnectionTestResult> {
  return api.post<ConnectionTestResult>(`/admin/suppliers/${id}/test-connection`);
}

export interface OrderFilter {
  supplierCode?: string;
  merchantId?: string;
  status?: OrderStatus;
  limit?: number;
}

export function fetchOrders(filter: OrderFilter, signal?: AbortSignal): Promise<Paginated<AdminOrder>> {
  return api.get<Paginated<AdminOrder>>("/admin/orders", {
    query: {
      supplierCode: filter.supplierCode,
      merchantId: filter.merchantId,
      status: filter.status,
      page: 1,
      limit: filter.limit ?? 20,
    },
    signal,
  });
}

export function fetchOrder(transCode: string, signal?: AbortSignal): Promise<AdminOrder> {
  return api.get<AdminOrder>(`/admin/orders/${transCode}`, { signal });
}

export function fetchOrderEvents(transCode: string, signal?: AbortSignal): Promise<OrderEvent[]> {
  return api.get<OrderEvent[]>(`/admin/orders/${transCode}/events`, { signal });
}

export interface IntegrationPreviewInput {
  baseUrl: string;
  params: Record<string, unknown>;
  kind: "LOGIN" | "PACKAGES" | "CHECK" | "SUBMIT" | "QUERY" | "ORDERS" | "TEST" | "CALLBACK";
  order?: Record<string, unknown>;
  response?: { httpStatus?: number; body?: unknown; headers?: Record<string, string> };
}

export interface IntegrationPreviewOutput {
  issues: string[];
  warnings: string[];
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: unknown;
    signature: string | null;
  } | null;
  result: {
    outcome: string;
    errorCode: string | null;
    errorMessage: string | null;
    supplierTransId: string | null;
    delivery: Record<string, string> | null;
    retryAfterSec: number | null;
  } | null;
  explain: string | null;
}

export interface SupplierPackage {
  code: string;
  name: string;
  price: number | null;
  description: string | null;
}

export interface PackageCheck {
  eligible: boolean | null;
  reason: { code: string; message: string } | null;
}

export interface SupplierOrderSummary {
  transCode: string | null;
  supplierTransId: string | null;
  status: string | null;
  outcome: string;
  errorCode: string | null;
  createdAt: string | null;
}

export interface FlowOutputs {
  packages?: SupplierPackage[];
  check?: PackageCheck;
  orders?: SupplierOrderSummary[];
}

export function previewIntegration(input: IntegrationPreviewInput): Promise<IntegrationPreviewOutput & FlowOutputs> {
  return api.post<IntegrationPreviewOutput & FlowOutputs>("/admin/suppliers/integration-preview", input);
}

export interface LiveExchange {
  request: { method: string; url: string; headers: Record<string, string>; body: unknown };
  response:
    | {
        ok: true;
        httpStatus: number;
        durationMs: number;
        headers: Record<string, string>;
        body: unknown;
        truncated: boolean;
      }
    | { ok: false; error: "TIMEOUT" | "NETWORK"; message: string; durationMs: number };
}

export type LiveCallKind = "PACKAGES" | "CHECK" | "QUERY" | "ORDERS" | "TEST";

export interface IntegrationCallInput {
  params: Record<string, unknown>;
  kind: LiveCallKind;
  order?: {
    transCode?: string;
    supplierTransId?: string;
    action?: string;
    packageCode?: string;
    phone?: string;
    serial?: string;
  };
  range?: { from?: string; to?: string };
  secrets?: Record<string, string>;
}

export interface IntegrationCallOutput {
  issues: string[];
  login: (LiveExchange & { ok: boolean; message: string | null }) | null;
  call: LiveExchange | null;
  result: IntegrationPreviewOutput["result"];
  explain: string | null;
  packages?: SupplierPackage[];
  check?: PackageCheck;
  orders?: SupplierOrderSummary[];
}

export interface SupplierOrdersOutput {
  supported: boolean;
  ok: boolean;
  message: string | null;
  orders: SupplierOrderSummary[];
  durationMs: number;
}

export function fetchSupplierOrders(
  supplierId: string,
  range: { from: string; to: string },
): Promise<SupplierOrdersOutput> {
  return api.post<SupplierOrdersOutput>(`/admin/suppliers/${supplierId}/supplier-orders`, range);
}

export function callIntegration(supplierId: string, input: IntegrationCallInput): Promise<IntegrationCallOutput> {
  return api.post<IntegrationCallOutput>(`/admin/suppliers/${supplierId}/integration-call`, input);
}

export function checkOrderNow(transCode: string): Promise<{ queued: boolean }> {
  return api.post<{ queued: boolean }>(`/admin/orders/${transCode}/check`);
}

export function lookupOrder(transCode: string): Promise<OrderLookup> {
  return api.post<OrderLookup>(`/admin/orders/${transCode}/lookup`);
}

export function recheckOrder(transCode: string, reason?: string): Promise<AdminOrder> {
  return api.post<AdminOrder>(`/admin/orders/${transCode}/recheck`, reason ? { reason } : {});
}

export function resolveOrder(transCode: string, input: ResolveOrderInput): Promise<AdminOrder> {
  return api.post<AdminOrder>(`/admin/orders/${transCode}/resolve`, input);
}
