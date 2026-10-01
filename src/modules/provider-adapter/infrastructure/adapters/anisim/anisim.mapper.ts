import {
  OrderDelivery,
  Outcome,
  SUPPLIER_CONFIG_ERROR,
  SupplierResult,
  SupplierTrace,
  unknownResult,
} from '@modules/provider-adapter/domain/supplier-result';
import { HttpResult } from '@modules/provider-adapter/infrastructure/http/http-json.client';

export interface AnisimOrder {
  id?: string;
  code?: string;
  requestId?: string;
  status?: number;
  qrStatus?: number;
  msisdn?: string | null;
  serial?: string | null;
  lpa?: string | null;
  urlLpa?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

interface AnisimEnvelope {
  code?: number;
  message?: string;
  data?: unknown;
}

const QR_SUCCESS = 2;

/** Order status ANI: 1 PENDING, 2 PROCESSING, 3 REGISTERED, 4 COMPLETED, 5 FAILED, 6 CANCELLED. */
export function mapAnisimOrder(
  order: AnisimOrder,
  trace: SupplierTrace,
): SupplierResult {
  const base = {
    supplierTransId: order.id ?? undefined,
    delivery: deliveryOf(order),
    trace,
  };
  const status = Number(order.status);

  switch (status) {
    case 1:
    case 2:
    case 3:
      return { ...base, outcome: Outcome.PENDING };
    case 4:
      return { ...base, outcome: Outcome.SUCCESS };
    case 5:
      return {
        ...base,
        outcome: Outcome.FAILED,
        error: {
          code: order.errorCode ? `ANI_${order.errorCode}` : 'ANI_ORDER_FAILED',
          message: order.errorMessage ?? 'ANI SIM đăng ký thất bại',
          supplierCode: '5',
        },
      };
    case 6:
      return {
        ...base,
        outcome: Outcome.FAILED,
        error: {
          code: 'ANI_ORDER_CANCELLED',
          message: order.errorMessage ?? 'ANI SIM đã huỷ đơn',
          supplierCode: '6',
        },
      };
    default:
      return {
        ...base,
        outcome: Outcome.UNKNOWN,
        error: {
          code: 'ANI_UNKNOWN_STATUS',
          message: `Trạng thái đơn ANI không xác định: ${String(order.status)}`,
        },
      };
  }
}

export function classifyAnisimCreate(
  res: HttpResult,
  trace: SupplierTrace,
): SupplierResult {
  if (!res.ok) return transportUnknown(res, trace);

  const env = (res.body ?? {}) as AnisimEnvelope;
  const code = typeof env.code === 'number' ? env.code : undefined;
  const message = env.message ?? `HTTP ${res.status}`;

  if (res.status < 300 && code === 0 && env.data) {
    return mapAnisimOrder(env.data, trace);
  }
  if (res.status === 409 || code === 4002) {
    return unknownResult(message, trace, 'ANI_4002');
  }
  if (res.status === 429 || code === 1000) {
    return unknownResult(message, trace, 'ANI_RATE_LIMIT');
  }
  if (
    code === 2001 ||
    code === 2002 ||
    res.status === 401 ||
    res.status === 403
  ) {
    return failed(SUPPLIER_CONFIG_ERROR, message, code ?? res.status, trace);
  }
  if (
    code === 4000 ||
    code === 4001 ||
    code === 6000 ||
    res.status === 400 ||
    res.status === 404
  ) {
    return failed(
      `ANI_${code ?? res.status}`,
      message,
      code ?? res.status,
      trace,
    );
  }
  return unknownResult(message, trace, `ANI_${code ?? res.status}`);
}

/** Lỗi khi tra cứu không bao giờ làm đơn FAILED: chỉ trạng thái đơn mới quyết định. */
export function classifyAnisimQuery(
  res: HttpResult,
  transCode: string,
  trace: SupplierTrace,
): SupplierResult {
  if (!res.ok) return transportUnknown(res, trace);

  const env = (res.body ?? {}) as AnisimEnvelope;
  if (res.status >= 300 || env.code !== 0) {
    return unknownResult(
      env.message ?? `HTTP ${res.status}`,
      trace,
      `ANI_QUERY_${env.code ?? res.status}`,
    );
  }

  const items = (env.data as { items?: AnisimOrder[] } | null)?.items;
  const match = Array.isArray(items)
    ? items.find((item) => item.requestId === transCode)
    : undefined;

  if (!match) return { outcome: Outcome.NOT_FOUND, trace };
  return mapAnisimOrder(match, trace);
}

function deliveryOf(order: AnisimOrder): OrderDelivery | undefined {
  const delivery: OrderDelivery = {};
  if (order.msisdn) delivery.msisdn = order.msisdn;
  if (order.serial) delivery.serial = order.serial;
  if (order.qrStatus === QR_SUCCESS) {
    if (order.lpa) delivery.lpa = order.lpa;
    if (order.urlLpa) delivery.qrUrl = order.urlLpa;
  }
  return Object.keys(delivery).length > 0 ? delivery : undefined;
}

function failed(
  code: string,
  message: string,
  supplierCode: number | undefined,
  trace: SupplierTrace,
): SupplierResult {
  return {
    outcome: Outcome.FAILED,
    error: {
      code,
      message,
      supplierCode:
        supplierCode !== undefined ? String(supplierCode) : undefined,
    },
    trace,
  };
}

function transportUnknown(
  res: Extract<HttpResult, { ok: false }>,
  trace: SupplierTrace,
): SupplierResult {
  return unknownResult(
    res.message,
    trace,
    res.kind === 'TIMEOUT' ? 'SUPPLIER_TIMEOUT' : 'SUPPLIER_UNREACHABLE',
  );
}
