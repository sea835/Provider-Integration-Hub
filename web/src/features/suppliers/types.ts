export const SUPPLIER_STATUSES = ["ACTIVE", "PAUSED", "DISABLED"] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export const ORDER_STATUSES = ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "MANUAL_REVIEW", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface AdapterField {
  key: string;
  label: string;
  required: boolean;
  type?: "text" | "boolean";
  help?: string;
  placeholder?: string;
}

export type AdapterEditor = "FIELDS" | "HTTP_CONFIG";

export interface AdapterType {
  type: string;
  label: string;
  description: string;
  editor: AdapterEditor;
  actions: string[];
  callback: boolean;
  params: AdapterField[];
  secrets: AdapterField[];
  defaultParams?: Record<string, unknown>;
}

export interface SupplierTuning {
  submitTimeoutMs: number;
  queryTimeoutMs: number;
  concurrency: number;
  rateLimitPerMin: number;
  pollScheduleSec: number[];
  maxWaitSec: number;
  maxResubmit: number;
  callbackIpWhitelist: string[];
}

export interface Supplier extends SupplierTuning {
  id: string;
  code: string;
  name: string;
  adapterType: string;
  status: SupplierStatus;
  version: number;
  baseUrl: string;
  params: Record<string, unknown>;
  hasSecrets: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierInput extends Partial<SupplierTuning> {
  code: string;
  name: string;
  adapterType: string;
  baseUrl: string;
  params?: Record<string, unknown>;
  secrets?: Record<string, string>;
}

export interface UpdateSupplierInput extends Partial<SupplierTuning> {
  name?: string;
  baseUrl?: string;
  status?: SupplierStatus;
  params?: Record<string, unknown>;
  secrets?: Record<string, string>;
}

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  message: string;
}

export interface AdminOrder {
  id: string;
  transCode: string;
  merchantId: string;
  requestId: string;
  status: OrderStatus;
  action: string;
  supplierCode: string;
  packageCode: string;
  supplierTransId: string | null;
  configVersion: number;
  phone: string | null;
  serial: string | null;
  submitCount: number;
  checkCount: number;
  resubmitRequested: boolean;
  nextCheckAt: string | null;
  delivery: Record<string, string>;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface OrderEvent {
  id: string;
  source: string;
  type: string;
  outcome: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  configVersion: number | null;
  httpStatus: number | null;
  durationMs: number | null;
  message: string | null;
  request: unknown;
  response: unknown;
  createdAt: string;
}

export const DELIVERY_FIELDS = ["msisdn", "serial", "lpa", "qrUrl"] as const;
export type DeliveryField = (typeof DELIVERY_FIELDS)[number];
export type OrderDelivery = Partial<Record<DeliveryField, string>>;

export type LookupOutcome = "SUCCESS" | "FAILED" | "PENDING" | "UNKNOWN" | "NOT_FOUND";

export interface OrderLookup {
  transCode: string;
  supplierCode: string;
  outcome: LookupOutcome;
  supplierTransId: string | null;
  delivery: OrderDelivery | null;
  error: { code: string; message: string } | null;
  httpStatus: number | null;
  durationMs: number;
  request: unknown;
  response: unknown;
  checkedAt: string;
}

export interface ResolveOrderInput {
  outcome: "SUCCESS" | "FAILED";
  reason: string;
  errorCode?: string;
  supplierTransId?: string;
  delivery?: OrderDelivery;
}
