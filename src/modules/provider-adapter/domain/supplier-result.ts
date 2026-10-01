export const Outcome = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  PENDING: 'PENDING',
  UNKNOWN: 'UNKNOWN',
  NOT_FOUND: 'NOT_FOUND',
} as const;

export type OutcomeType = (typeof Outcome)[keyof typeof Outcome];

export interface OrderDelivery {
  msisdn?: string;
  serial?: string;
  lpa?: string;
  qrUrl?: string;
}

export interface SupplierTrace {
  request?: unknown;
  response?: unknown;
  httpStatus?: number;
  durationMs: number;
}

export interface SupplierError {
  code: string;
  message: string;
  supplierCode?: string;
}

/**
 * Kết quả chuẩn của mọi lời gọi NCC.
 * Quy tắc: chỉ FAILED khi NCC nói rõ thất bại; mọi trường hợp chưa chắc là UNKNOWN.
 */
export interface SupplierResult {
  outcome: OutcomeType;
  supplierTransId?: string;
  delivery?: OrderDelivery;
  error?: SupplierError;
  retryAfterSec?: number;
  trace: SupplierTrace;
}

export const SUPPLIER_CONFIG_ERROR = 'SUPPLIER_CONFIG';

export function unknownResult(
  message: string,
  trace: SupplierTrace = { durationMs: 0 },
  code = 'SUPPLIER_UNREACHABLE',
): SupplierResult {
  return { outcome: Outcome.UNKNOWN, error: { code, message }, trace };
}
