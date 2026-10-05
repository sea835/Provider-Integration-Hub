import type {
  OrderListResult,
  PackageCheckResult,
  PackageListResult,
  SupplierPackage,
} from '@modules/provider-adapter/domain/provider-adapter.port';
import {
  OrderDelivery,
  Outcome,
  SUPPLIER_CONFIG_ERROR,
  SupplierResult,
  SupplierTrace,
  unknownResult,
} from '@modules/provider-adapter/domain/supplier-result';
import { HttpResult } from '@modules/provider-adapter/infrastructure/http/http-json.client';

export interface StdOrder {
  requestId?: unknown;
  orderId?: unknown;
  status?: unknown;
  errorCode?: unknown;
  errorMessage?: unknown;
  delivery?: unknown;
  createdAt?: unknown;
}

interface StdEnvelope {
  code?: unknown;
  message?: unknown;
  data?: StdOrder | null;
}

const MAX_ERROR_CODE_LENGTH = 50;

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function deliveryOf(order: StdOrder): OrderDelivery | undefined {
  const raw = order.delivery;
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const delivery: OrderDelivery = {};
  for (const key of ['msisdn', 'serial', 'lpa', 'qrUrl'] as const) {
    const value = text(source[key]);
    if (value) delivery[key] = value;
  }
  return Object.keys(delivery).length > 0 ? delivery : undefined;
}

/** Trạng thái đơn theo quy chuẩn: PROCESSING, SUCCESS, FAILED. Giá trị khác là UNKNOWN. */
export function mapStdOrder(
  order: StdOrder,
  trace: SupplierTrace,
): SupplierResult {
  const base = {
    supplierTransId: text(order.orderId),
    delivery: deliveryOf(order),
    trace,
  };
  switch (order.status) {
    case 'PROCESSING':
      return { ...base, outcome: Outcome.PENDING };
    case 'SUCCESS':
      return { ...base, outcome: Outcome.SUCCESS };
    case 'FAILED': {
      const errorCode = text(order.errorCode);
      return {
        ...base,
        outcome: Outcome.FAILED,
        error: {
          code: (errorCode ?? 'REJECTED').slice(0, MAX_ERROR_CODE_LENGTH),
          message: text(order.errorMessage) ?? 'Nhà cung cấp từ chối đơn',
          supplierCode: errorCode,
        },
      };
    }
    default:
      return {
        ...base,
        outcome: Outcome.UNKNOWN,
        error: {
          code: 'STD_UNKNOWN_STATUS',
          message: `Trạng thái không có trong quy chuẩn: ${String(order.status)}`,
        },
      };
  }
}

type HttpOk = Extract<HttpResult, { ok: true }>;

function retryAfterOf(res: HttpOk): number | undefined {
  const seconds = Number(res.headers?.['retry-after']);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

function failed(
  code: string,
  message: string,
  trace: SupplierTrace,
): SupplierResult {
  return { outcome: Outcome.FAILED, error: { code, message }, trace };
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

/** 2xx + code OK + data: đọc trạng thái đơn. Trả null nếu không phải phản hồi thành công. */
function orderResult(
  res: HttpOk,
  transCode: string,
  trace: SupplierTrace,
): SupplierResult | null {
  const env = (res.body ?? {}) as StdEnvelope;
  if (res.status >= 300 || env.code !== 'OK' || !env.data) return null;
  const requestId = text(env.data.requestId);
  if (requestId && requestId !== transCode) {
    return unknownResult(
      `NCC trả đơn ${requestId}, không khớp ${transCode}`,
      trace,
      'STD_REQUEST_ID_MISMATCH',
    );
  }
  return mapStdOrder(env.data, trace);
}

function unknownFrom(res: HttpOk, trace: SupplierTrace): SupplierResult {
  const env = (res.body ?? {}) as StdEnvelope;
  const code = text(env.code) ?? String(res.status);
  const retryAfterSec = retryAfterOf(res);
  return {
    ...unknownResult(
      text(env.message) ?? `HTTP ${res.status}`,
      trace,
      `STD_${code}`,
    ),
    ...(retryAfterSec ? { retryAfterSec } : {}),
  };
}

/** POST /orders. Chỉ FAILED khi NCC từ chối rõ ràng: đơn FAILED, 400 INVALID_REQUEST, 401/403. */
export function classifyStdCreate(
  res: HttpResult,
  transCode: string,
  trace: SupplierTrace,
): SupplierResult {
  if (!res.ok) return transportUnknown(res, trace);
  const order = orderResult(res, transCode, trace);
  if (order) return order;

  const env = (res.body ?? {}) as StdEnvelope;
  const message = text(env.message) ?? `HTTP ${res.status}`;
  if (res.status === 400 && env.code === 'INVALID_REQUEST') {
    return failed('INVALID_REQUEST', message, trace);
  }
  if (res.status === 401 || res.status === 403) {
    return failed(SUPPLIER_CONFIG_ERROR, message, trace);
  }
  return unknownFrom(res, trace);
}

/** GET /orders/{requestId}. Lỗi khi tra cứu không bao giờ là FAILED; 404 ORDER_NOT_FOUND là NOT_FOUND. */
export function classifyStdQuery(
  res: HttpResult,
  transCode: string,
  trace: SupplierTrace,
): SupplierResult {
  if (!res.ok) return transportUnknown(res, trace);
  const order = orderResult(res, transCode, trace);
  if (order) return order;

  const env = (res.body ?? {}) as StdEnvelope;
  if (res.status === 404 && env.code === 'ORDER_NOT_FOUND') {
    return { outcome: Outcome.NOT_FOUND, trace };
  }
  return unknownFrom(res, trace);
}

interface StdListEnvelope {
  code?: unknown;
  message?: unknown;
  data?: {
    items?: unknown;
    eligible?: unknown;
    reasonCode?: unknown;
    reasonMessage?: unknown;
  } | null;
}

/** Lỗi chung của 3 API không bắt buộc; 404 NOT_SUPPORTED nghĩa là NCC không có API đó. */
function optionalApiFailure(res: HttpResult): {
  message: string;
  unsupported: boolean;
} | null {
  if (!res.ok) return { message: res.message, unsupported: false };
  const env = (res.body ?? {}) as StdListEnvelope;
  if (res.status === 404 && env.code === 'NOT_SUPPORTED') {
    return {
      message: 'Nhà cung cấp không có API này',
      unsupported: true,
    };
  }
  if (res.status >= 300 || env.code !== 'OK' || !env.data) {
    return {
      message:
        `HTTP ${res.status} ${text(env.code) ?? ''}: ${text(env.message) ?? ''}`.trim(),
      unsupported: false,
    };
  }
  return null;
}

function itemsOf(res: HttpResult): unknown[] {
  const env = (res.ok ? (res.body ?? {}) : {}) as StdListEnvelope;
  return Array.isArray(env.data?.items) ? env.data.items : [];
}

/** GET /packages → { items: [{ packageCode, name, price, description }] }. */
export function readStdPackages(
  res: HttpResult,
  trace: SupplierTrace,
): PackageListResult {
  const failure = optionalApiFailure(res);
  if (failure) return { ok: false, ...failure, trace };
  const packages = itemsOf(res).flatMap((raw): SupplierPackage[] => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const code = text(item.packageCode);
    if (!code) return [];
    const price =
      typeof item.price === 'number' ? item.price : Number(item.price);
    return [
      {
        code,
        name: text(item.name) ?? code,
        price:
          item.price !== undefined &&
          item.price !== null &&
          Number.isFinite(price)
            ? price
            : null,
        description: text(item.description) ?? null,
      },
    ];
  });
  return { ok: true, packages, trace };
}

/** POST /packages/check → { eligible, reasonCode, reasonMessage }. Không rõ thì eligible = null. */
export function readStdCheck(
  res: HttpResult,
  trace: SupplierTrace,
): PackageCheckResult {
  const failure = optionalApiFailure(res);
  if (failure) {
    return {
      eligible: null,
      reason: null,
      unsupported: failure.unsupported,
      trace,
    };
  }
  const data = ((res.ok ? res.body : null) as StdListEnvelope).data ?? {};
  if (data.eligible === true) return { eligible: true, reason: null, trace };
  if (data.eligible === false) {
    return {
      eligible: false,
      reason: {
        code: (text(data.reasonCode) ?? 'PACKAGE_NOT_ELIGIBLE').slice(
          0,
          MAX_ERROR_CODE_LENGTH,
        ),
        message:
          text(data.reasonMessage) ??
          'Nhà cung cấp báo không đăng ký được gói này',
      },
      trace,
    };
  }
  return { eligible: null, reason: null, trace };
}

/** GET /orders?from&to → { items: [đơn theo quy chuẩn + createdAt] }. */
export function readStdOrders(
  res: HttpResult,
  trace: SupplierTrace,
): OrderListResult {
  const failure = optionalApiFailure(res);
  if (failure) return { ok: false, ...failure, trace };
  const orders = itemsOf(res).map((raw) => {
    const order = (raw ?? {}) as StdOrder;
    const mapped = mapStdOrder(order, { durationMs: 0 });
    return {
      transCode: text(order.requestId) ?? null,
      supplierTransId: mapped.supplierTransId ?? null,
      status: text(order.status) ?? null,
      outcome: mapped.outcome,
      errorCode: mapped.error?.code ?? null,
      createdAt: text(order.createdAt) ?? null,
    };
  });
  return { ok: true, orders, trace };
}
