import { OrderActionType } from '@modules/provider-adapter/domain/order-action';
import { SupplierResult } from '@modules/provider-adapter/domain/supplier-result';

export interface SupplierContext {
  supplierId: string;
  supplierCode: string;
  baseUrl: string;
  secrets: Record<string, unknown>;
  params: Record<string, unknown>;
  timeouts: { submitMs: number; queryMs: number };
  configVersion: number;
}

/** Lệnh đăng ký gửi sang NCC. `packageCode` là mã gói phía NCC do Store chỉ định. */
export interface OrderCommand {
  transCode: string;
  action: OrderActionType;
  packageCode: string;
  phone: string | null;
  serial: string | null;
}

export interface OrderRef {
  transCode: string;
  supplierTransId: string | null;
}

export interface RawCallback {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
  ip: string;
}

export interface ParsedCallback {
  eventId: string;
  transCode?: string;
  supplierTransId?: string;
  result: SupplierResult;
}

export interface AdapterCapabilities {
  actions: OrderActionType[];
  callback: boolean;
}

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  message: string;
}

export type ConfigClass = new () => object;

/**
 * Contract chung cho mọi NCC.
 * Adapter stateless: chỉ đọc `ctx`, không throw với kết quả nghiệp vụ.
 */
export interface ProviderAdapter {
  readonly type: string;
  readonly capabilities: AdapterCapabilities;
  readonly paramsClass: ConfigClass;
  readonly secretsClass: ConfigClass;

  submit(ctx: SupplierContext, cmd: OrderCommand): Promise<SupplierResult>;
  query(ctx: SupplierContext, ref: OrderRef): Promise<SupplierResult>;
  testConnection(ctx: SupplierContext): Promise<ConnectionTestResult>;

  verifyCallback?(ctx: SupplierContext, raw: RawCallback): Promise<boolean>;
  parseCallback?(
    ctx: SupplierContext,
    raw: RawCallback,
  ): Promise<ParsedCallback>;
}

export const PROVIDER_ADAPTERS = Symbol('PROVIDER_ADAPTERS');
