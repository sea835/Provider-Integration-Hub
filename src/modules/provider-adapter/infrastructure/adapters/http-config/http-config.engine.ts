import { createHash, createHmac, randomUUID } from 'node:crypto';
import type {
  SupplierOrderSummary,
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
import {
  CallKind,
  HttpConfigParams,
  IntegrationSpec,
  OrderMapping,
  RequestSpec,
  HttpMethod,
  SignatureRule,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.types';
import {
  allMatch,
  anyMatch,
  asString,
  evaluate,
  evaluateItem,
  isEmpty,
  listAnchor,
  render,
  renderValue,
  resolvePath,
  Scope,
  setPath,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.template';

const MAX_ERROR_CODE_LENGTH = 50;
/** Đường dẫn ghi đầy đủ `https://...` thì gọi thẳng (vd máy chủ đăng nhập khác máy chủ API). */
const ABSOLUTE_URL = /^https?:\/\//i;

export interface OrderInput {
  transCode: string;
  action: string;
  packageCode: string;
  phone: string | null;
  serial: string | null;
  supplierTransId: string | null;
  extra?: Record<string, unknown>;
}

export interface BuiltRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  rawBody?: string;
  /** Body dạng đối tượng để ghi trace (chưa che bí mật). */
  bodyForTrace?: unknown;
  signature?: string;
  /** Đúng chuỗi đã đem ký, để người cấu hình đối chiếu với tài liệu NCC. */
  signedPayload?: string;
  /** Tên quy tắc chữ ký đã dùng. */
  signatureRule?: string;
}

/** Kết quả phân loại kèm lời giải thích để giao diện "Phân loại thử" hiển thị. */
export interface Classified {
  result: SupplierResult;
  explain: string;
}

export interface ScopeExtras {
  /** Token đăng nhập (khi bật Đăng nhập lấy token). */
  token?: string | null;
  /** Khoảng thời gian cho API danh sách đơn. */
  range?: { from: Date; to: Date };
}

const VN_OFFSET_MS = 7 * 3_600_000;

/** Một mốc thời gian ở các dạng hay gặp; `date`/`datetime` theo giờ Việt Nam. */
function timeParts(ms: number) {
  const vn = new Date(ms + VN_OFFSET_MS).toISOString();
  return {
    unix: Math.floor(ms / 1000),
    unixMs: ms,
    iso: new Date(ms).toISOString(),
    date: vn.slice(0, 10),
    datetime: `${vn.slice(0, 10)} ${vn.slice(11, 19)}`,
  };
}

/** Phạm vi biến cho một lời gọi. `uuid` và `now` mới cho mỗi lời gọi, dùng chung trong cùng lời gọi. */
export function requestScope(
  params: HttpConfigParams,
  secrets: Record<string, unknown>,
  order: OrderInput | null,
  extras: ScopeExtras = {},
): Scope {
  const phone = order?.phone ?? null;
  const now = Date.now();
  return {
    order: order
      ? {
          ...order,
          extra: order.extra ?? {},
          phone84: phone ? `84${phone.slice(1)}` : null,
          phone9: phone ? phone.slice(1) : null,
        }
      : {},
    vars: params.vars,
    secrets,
    token: extras.token ?? '',
    uuid: randomUUID(),
    now: timeParts(now),
    ...(extras.range
      ? {
          range: {
            from: timeParts(extras.range.from.getTime()),
            to: timeParts(extras.range.to.getTime()),
          },
        }
      : {}),
  };
}

function typed(value: unknown, type: string): unknown {
  if (type === 'array' && isEmpty(value)) return [];
  if (isEmpty(value)) return value ?? null;
  if (type === 'number') {
    const num = Number(value);
    return Number.isFinite(num) ? num : asString(value);
  }
  if (type === 'boolean') return asString(value) === 'true';
  if (type === 'array') {
    if (Array.isArray(value)) return value;
    return asString(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return typeof value === 'string' ? value : asString(value);
}

const HMAC_ALGORITHMS: Record<string, string> = {
  HMAC_SHA256: 'sha256',
  HMAC_SHA512: 'sha512',
  HMAC_SHA1: 'sha1',
  HMAC_MD5: 'md5',
};

const HASH_ALGORITHMS: Record<string, string> = {
  SHA256: 'sha256',
  MD5: 'md5',
};

/** Quy tắc chữ ký đầu tiên khớp lời gọi và phương thức; không có thì không ký. */
export function signatureRuleFor(
  spec: IntegrationSpec,
  kind: CallKind,
  method: HttpMethod,
): SignatureRule | undefined {
  if (!spec.signature.enabled) return undefined;
  return spec.signature.rules.find(
    (rule) =>
      rule.apply[kind] &&
      (rule.methods.length === 0 || rule.methods.includes(method)),
  );
}

/** Tính chữ ký theo cấu hình. Không phụ thuộc NCC nào. */
export function computeSignature(
  signature: SignatureRule,
  payload: string,
  scope: Scope,
): string {
  const hmac = HMAC_ALGORITHMS[signature.algorithm];
  const digest = hmac
    ? createHmac(hmac, render(signature.key, scope)).update(payload).digest()
    : createHash(HASH_ALGORITHMS[signature.algorithm] ?? 'sha256')
        .update(payload)
        .digest();
  if (signature.encoding === 'BASE64') return digest.toString('base64');
  const hex = digest.toString('hex');
  return signature.encoding === 'HEX_UPPER' ? hex.toUpperCase() : hex;
}

export function buildRequest(
  spec: IntegrationSpec,
  request: RequestSpec,
  baseUrl: string,
  scope: Scope,
  kind: CallKind,
): BuiltRequest {
  const path = render(request.path, scope, encodeURIComponent);
  const url = ABSOLUTE_URL.test(path)
    ? new URL(path)
    : new URL(
        `${baseUrl.replace(/\/+$/, '')}${path.startsWith('/') || !path ? path : `/${path}`}`,
      );
  for (const item of request.query) {
    const value = render(item.value, scope);
    if (item.omitIfEmpty && value === '') continue;
    url.searchParams.append(item.name, value);
  }

  const headers: Record<string, string> = {};
  const { auth } = spec;
  if (auth.type === 'HEADER' && auth.name) {
    const value = render(auth.value, scope);
    if (value) headers[auth.name] = value;
  } else if (auth.type === 'BEARER') {
    const value = render(auth.value, scope);
    if (value) headers.Authorization = `Bearer ${value}`;
  } else if (auth.type === 'BASIC') {
    const raw = `${render(auth.username, scope)}:${render(auth.password, scope)}`;
    headers.Authorization = `Basic ${Buffer.from(raw).toString('base64')}`;
  } else if (auth.type === 'QUERY' && auth.name) {
    const value = render(auth.value, scope);
    if (value) url.searchParams.set(auth.name, value);
  }
  for (const header of spec.headers) {
    const value = render(header.value, scope);
    if (header.omitIfEmpty && value === '') continue;
    headers[header.name] = value;
  }

  const hasBody = request.bodyType !== 'NONE' && request.method !== 'GET';
  let rawBody: string | undefined;
  let bodyForTrace: unknown;
  let body: Record<string, unknown> | null = null;
  let form: URLSearchParams | null = null;

  if (hasBody && request.bodyType === 'FORM') {
    form = new URLSearchParams();
    const shown: Record<string, string> = {};
    for (const field of request.body) {
      const value = render(field.value, scope);
      if (field.omitIfEmpty && value === '') continue;
      form.append(field.key, value);
      shown[field.key] = value;
    }
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    rawBody = form.toString();
    bodyForTrace = shown;
  } else if (hasBody) {
    body = {};
    for (const field of request.body) {
      const value = renderValue(field.value, scope);
      if (field.omitIfEmpty && isEmpty(value)) continue;
      setPath(body, field.key, typed(value, field.type));
    }
    rawBody = JSON.stringify(body);
    bodyForTrace = body;
  }

  const sign = signatureRuleFor(spec, kind, request.method);
  let signature: string | undefined;
  let signedPayload: string | undefined;
  if (sign) {
    const unsigned = rawBody ?? '';
    signedPayload =
      sign.input === 'BODY'
        ? unsigned
        : render(sign.template, {
            ...scope,
            request: {
              method: request.method,
              path: `${url.pathname}${url.search}`,
              query: url.search.replace(/^\?/, ''),
              body: unsigned,
            },
          });
    signature = computeSignature(sign, signedPayload, scope);
    if (sign.target === 'HEADER') {
      headers[sign.name] = signature;
    } else if (body) {
      setPath(body, sign.name, signature);
      rawBody = JSON.stringify(body);
    } else if (form) {
      form.append(sign.name, signature);
      rawBody = form.toString();
      bodyForTrace = {
        ...(bodyForTrace as Record<string, string>),
        [sign.name]: signature,
      };
    } else {
      url.searchParams.append(sign.name, signature);
    }
  }

  return {
    method: request.method,
    url: url.toString(),
    headers,
    ...(rawBody !== undefined ? { rawBody, bodyForTrace } : {}),
    ...(signature && sign
      ? { signature, signedPayload, signatureRule: sign.label }
      : {}),
  };
}

export type TokenReading =
  | { ok: true; token: string; ttlSec: number }
  | { ok: false; reason: 'TRANSPORT' | 'REJECTED'; message: string };

/** Đọc token từ phản hồi đăng nhập. */
export function readToken(
  spec: IntegrationSpec,
  res: HttpResult,
): TokenReading {
  if (!res.ok) return { ok: false, reason: 'TRANSPORT', message: res.message };
  const scope = responseScope(res);
  const conditions =
    spec.token.success.length > 0
      ? spec.token.success
      : [{ path: 'http.status', operator: 'IN' as const, values: ['2xx'] }];
  const token = asString(resolvePath(scope.body, spec.token.tokenPath));
  if (!allMatch(conditions, scope) || !token) {
    const message =
      asString(evaluate('body.message', scope)) || `HTTP ${res.status}`;
    return {
      ok: false,
      reason: res.status >= 500 ? 'TRANSPORT' : 'REJECTED',
      message: token
        ? message
        : `${message} (không thấy token ở ${spec.token.tokenPath || '(chưa khai báo)'})`,
    };
  }
  const expires = Number(
    spec.token.expiresInPath
      ? resolvePath(scope.body, spec.token.expiresInPath)
      : NaN,
  );
  return {
    ok: true,
    token,
    ttlSec:
      Number.isFinite(expires) && expires > 0
        ? Math.floor(expires)
        : spec.token.ttlSec,
  };
}

/** Phản hồi cho thấy token hết hạn / sai: lấy token mới rồi gửi lại một lần. */
export function needsTokenRefresh(
  spec: IntegrationSpec,
  res: HttpResult,
): boolean {
  if (!spec.token.enabled || !res.ok || spec.token.refreshOn.length === 0)
    return false;
  return anyMatch(spec.token.refreshOn, responseScope(res));
}

function responseScope(res: Extract<HttpResult, { ok: true }>): Scope {
  return {
    http: { status: res.status },
    body: res.body ?? res.rawText,
    headers: res.headers ?? {},
  };
}

function retryAfterOf(
  res: Extract<HttpResult, { ok: true }>,
): number | undefined {
  const seconds = Number(res.headers?.['retry-after']);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

function code(value: string): string {
  return value.slice(0, MAX_ERROR_CODE_LENGTH);
}

function transport(
  res: Extract<HttpResult, { ok: false }>,
  trace: SupplierTrace,
): Classified {
  return {
    result: unknownResult(
      res.message,
      trace,
      res.kind === 'TIMEOUT' ? 'SUPPLIER_TIMEOUT' : 'SUPPLIER_UNREACHABLE',
    ),
    explain:
      res.kind === 'TIMEOUT'
        ? 'Hết thời gian chờ: chưa biết kết quả, Hub sẽ tra cứu lại'
        : 'Không kết nối được tới nhà cung cấp: chưa biết kết quả, Hub sẽ tra cứu lại',
  };
}

function deliveryOf(
  order: unknown,
  mapping: OrderMapping,
): OrderDelivery | undefined {
  const delivery: OrderDelivery = {};
  for (const key of ['msisdn', 'serial', 'lpa', 'qrUrl'] as const) {
    const path = mapping.delivery[key];
    if (!path) continue;
    const value = asString(evaluateItem(path, order));
    if (value) delivery[key] = value;
  }
  return Object.keys(delivery).length > 0 ? delivery : undefined;
}

/** Đọc một đơn của NCC theo bảng trạng thái. Giá trị không có trong bảng là UNKNOWN. */
export function mapOrder(
  order: unknown,
  mapping: OrderMapping,
  trace: SupplierTrace,
): Classified {
  if (!order || typeof order !== 'object') {
    return {
      result: unknownResult(
        'Không đọc được đơn hàng trong phản hồi',
        trace,
        'ORDER_NOT_READABLE',
      ),
      explain: 'Không tìm thấy đối tượng đơn hàng ở vị trí đã khai báo',
    };
  }
  const scope = order as Scope;
  const status = asString(evaluateItem(mapping.status, scope));
  const base = {
    supplierTransId:
      asString(evaluateItem(mapping.supplierTransId, scope)) || undefined,
    delivery: deliveryOf(order, mapping),
    trace,
  };
  const entry = mapping.statusMap.find((item) => item.value === status);
  if (!entry) {
    return {
      result: {
        ...base,
        outcome: Outcome.UNKNOWN,
        error: {
          code: code(`${mapping.errorCodePrefix}UNKNOWN_STATUS`),
          message: `Trạng thái "${status}" chưa có trong bảng trạng thái`,
        },
      },
      explain: `Trạng thái "${status}" chưa khai báo nên coi là chưa biết`,
    };
  }
  if (entry.outcome === 'SUCCESS') {
    return {
      result: { ...base, outcome: Outcome.SUCCESS },
      explain: `Trạng thái "${status}" = Thành công`,
    };
  }
  if (entry.outcome === 'PENDING') {
    return {
      result: { ...base, outcome: Outcome.PENDING },
      explain: `Trạng thái "${status}" = Đang xử lý`,
    };
  }
  const supplierError = asString(evaluateItem(mapping.errorCode, scope));
  const errorCode =
    entry.errorCode ||
    `${mapping.errorCodePrefix}${supplierError || 'ORDER_FAILED'}`;
  return {
    result: {
      ...base,
      outcome: Outcome.FAILED,
      error: {
        code: code(errorCode),
        message:
          asString(evaluateItem(mapping.errorMessage, scope)) ||
          'Nhà cung cấp báo đơn thất bại',
        supplierCode: supplierError || status,
      },
    },
    explain: `Trạng thái "${status}" = Thất bại, mã lỗi ${code(errorCode)}`,
  };
}

function messageOf(path: string, scope: Scope, status: number): string {
  return asString(evaluate(path || 'body.message', scope)) || `HTTP ${status}`;
}

function successOrNull(
  conditions: IntegrationSpec['submit']['success'],
  res: Extract<HttpResult, { ok: true }>,
): Scope | null {
  const scope = responseScope(res);
  const conds =
    conditions.length > 0
      ? conditions
      : [{ path: 'http.status', operator: 'IN' as const, values: ['2xx'] }];
  return allMatch(conds, scope) ? scope : null;
}

/** Gửi đơn. FAILED chỉ khi trạng thái đơn là thất bại hoặc một luật Từ chối / Sai cấu hình khớp. */
export function classifySubmit(
  spec: IntegrationSpec,
  res: HttpResult,
  trace: SupplierTrace,
): Classified {
  if (!res.ok) return transport(res, trace);
  const scope = responseScope(res);

  if (successOrNull(spec.submit.success, res)) {
    const order = spec.submit.orderPath
      ? resolvePath(scope.body, spec.submit.orderPath)
      : scope.body;
    const mapped = mapOrder(order, spec.order, trace);
    if (spec.submit.resultMode === 'POLL') {
      const { supplierTransId, delivery } = mapped.result;
      return {
        result: {
          outcome: Outcome.PENDING,
          ...(supplierTransId ? { supplierTransId } : {}),
          ...(delivery ? { delivery } : {}),
          trace,
        },
        explain: `Nhà cung cấp đã nhận đơn${supplierTransId ? ` (mã ${supplierTransId})` : ''}. Chế độ chờ tra cứu: Hub không đọc trạng thái lúc tạo, sẽ tra cứu để biết kết quả`,
      };
    }
    return mapped;
  }

  const message = messageOf(spec.submit.messagePath, scope, res.status);
  for (const rule of spec.submit.rules) {
    if (rule.conditions.length === 0 || !allMatch(rule.conditions, scope))
      continue;
    const label = rule.name || 'không tên';
    if (rule.outcome === 'CONFIG_ERROR') {
      return {
        result: {
          outcome: Outcome.FAILED,
          error: { code: SUPPLIER_CONFIG_ERROR, message },
          trace,
        },
        explain: `Khớp luật "${label}": sai cấu hình hoặc khoá, đơn thất bại`,
      };
    }
    const errorCode = code(
      render(rule.errorCode, scope) || `HTTP_${res.status}`,
    );
    if (rule.outcome === 'REJECTED') {
      return {
        result: {
          outcome: Outcome.FAILED,
          error: { code: errorCode, message },
          trace,
        },
        explain: `Khớp luật "${label}": nhà cung cấp từ chối, đơn thất bại với mã ${errorCode}`,
      };
    }
    const retryAfterSec = retryAfterOf(res);
    return {
      result: {
        ...unknownResult(message, trace, errorCode),
        ...(retryAfterSec ? { retryAfterSec } : {}),
      },
      explain: `Khớp luật "${label}": chưa biết kết quả, Hub sẽ tra cứu lại`,
    };
  }

  const retryAfterSec = retryAfterOf(res);
  return {
    result: {
      ...unknownResult(message, trace, `HTTP_${res.status}`),
      ...(retryAfterSec ? { retryAfterSec } : {}),
    },
    explain: 'Không khớp luật nào: chưa biết kết quả, Hub sẽ tra cứu lại',
  };
}

/** Tra cứu. Lỗi khi tra cứu không bao giờ là FAILED. */
export function classifyQuery(
  spec: IntegrationSpec,
  res: HttpResult,
  transCode: string,
  trace: SupplierTrace,
): Classified {
  if (!res.ok) return transport(res, trace);
  const scope = responseScope(res);
  const { query } = spec;

  if (successOrNull(query.success, res)) {
    const found = query.orderPath
      ? resolvePath(scope.body, query.orderPath)
      : scope.body;
    if (query.matchField) {
      const value = asString(evaluateItem(query.matchField, found));
      if (value && value !== transCode) {
        return {
          result: unknownResult(
            `Nhà cung cấp trả đơn ${value}, không khớp ${transCode}`,
            trace,
            'REQUEST_ID_MISMATCH',
          ),
          explain: 'Mã đơn trong phản hồi không khớp: chưa biết kết quả',
        };
      }
    }
    return mapOrder(found, spec.order, trace);
  }

  if (query.notFound.length > 0 && allMatch(query.notFound, scope)) {
    return {
      result: { outcome: Outcome.NOT_FOUND, trace },
      explain: 'Nhà cung cấp báo không có đơn: Hub sẽ gửi lại đơn',
    };
  }
  return {
    result: unknownResult(
      messageOf(query.messagePath, scope, res.status),
      trace,
      `HTTP_${res.status}`,
    ),
    explain: 'Tra cứu không thành công: chưa biết kết quả, Hub sẽ tra cứu lại',
  };
}

function successConditions(conditions: IntegrationSpec['submit']['success']) {
  return conditions.length > 0
    ? conditions
    : [{ path: 'http.status', operator: 'IN' as const, values: ['2xx'] }];
}

function listAt(body: unknown, path: string): unknown[] | null {
  const clean = path.trim().replace(/\[\*\]$/, '');
  const found = clean ? resolvePath(body, clean) : body;
  return Array.isArray(found) ? (found as unknown[]) : null;
}

/** Vị trí danh sách: ô đã khai báo, nếu trống thì lấy từ các ô dạng `data.items[*].x`. */
function listPathOf(declared: string, fields: string[]): string {
  if (declared.trim()) return declared;
  for (const field of fields) {
    const anchor = field ? listAnchor(field) : null;
    if (anchor !== null) return anchor;
  }
  return '';
}

export function packagesListPath(spec: IntegrationSpec): string {
  const { packages } = spec;
  return listPathOf(packages.listPath, [
    packages.code,
    packages.name,
    packages.price,
    packages.description,
  ]);
}

export function ordersListPath(spec: IntegrationSpec): string {
  return listPathOf(spec.orders.listPath, [
    spec.orders.matchField,
    spec.order.status,
    spec.order.supplierTransId,
    spec.orders.createdAt,
  ]);
}

export interface PackagesReading {
  ok: boolean;
  packages: SupplierPackage[];
  message: string;
  explain: string;
}

/** API 1: đọc danh sách gói về dạng chuẩn {code, name, price, description}. */
export function readPackages(
  spec: IntegrationSpec,
  res: HttpResult,
): PackagesReading {
  const fail = (message: string, explain: string): PackagesReading => ({
    ok: false,
    packages: [],
    message,
    explain,
  });
  if (!res.ok) {
    return fail(res.message, 'Không gọi được API danh sách gói');
  }
  const scope = responseScope(res);
  const { packages } = spec;
  if (!allMatch(successConditions(packages.success), scope)) {
    const message = messageOf('body.message', scope, res.status);
    return fail(message, 'Phản hồi không đạt điều kiện thành công');
  }
  const listPath = packagesListPath(spec);
  const items = listAt(scope.body, listPath);
  if (!items) {
    const where = listPath || '(cả phản hồi)';
    return fail(
      `Không thấy danh sách gói ở ${where}`,
      `Vị trí ${where} không phải danh sách`,
    );
  }
  const list = items.flatMap((item): SupplierPackage[] => {
    const value = (path: string) =>
      path ? evaluateItem(path, item) : undefined;
    const code = asString(value(packages.code));
    if (!code) return [];
    const rawPrice = value(packages.price);
    const price = Number(rawPrice);
    return [
      {
        code,
        name: asString(value(packages.name)) || code,
        price: !isEmpty(rawPrice) && Number.isFinite(price) ? price : null,
        description: asString(value(packages.description)) || null,
      },
    ];
  });
  return {
    ok: true,
    packages: list,
    message: '',
    explain: `Đọc được ${list.length}/${items.length} gói (bỏ qua phần tử không có mã gói)`,
  };
}

export interface CheckReading {
  eligible: boolean | null;
  reason: { code: string; message: string } | null;
  explain: string;
}

/** API 2: gói có đăng ký được không. Không chắc thì là null (Hub vẫn gửi đơn). */
export function readCheck(
  spec: IntegrationSpec,
  res: HttpResult,
): CheckReading {
  if (!res.ok) {
    return {
      eligible: null,
      reason: null,
      explain: `Không gọi được API kiểm tra (${res.message}): chưa rõ, Hub vẫn gửi đơn`,
    };
  }
  const scope = responseScope(res);
  const { check } = spec;
  if (check.eligible.length > 0 && allMatch(check.eligible, scope)) {
    return {
      eligible: true,
      reason: null,
      explain: 'Khớp điều kiện đăng ký được',
    };
  }
  if (check.ineligible.length > 0 && allMatch(check.ineligible, scope)) {
    const supplierCode = check.reasonCode
      ? asString(evaluate(check.reasonCode, scope))
      : '';
    const errorCode = code(
      supplierCode
        ? `${check.errorCodePrefix}${supplierCode}`
        : 'PACKAGE_NOT_ELIGIBLE',
    );
    return {
      eligible: false,
      reason: {
        code: errorCode,
        message:
          asString(evaluate(check.reasonMessage || 'body.message', scope)) ||
          'Nhà cung cấp báo không đăng ký được gói này',
      },
      explain: `Khớp điều kiện không đăng ký được: đơn thất bại với mã ${errorCode}, không gửi đơn`,
    };
  }
  return {
    eligible: null,
    reason: null,
    explain: 'Không khớp điều kiện nào: chưa rõ, Hub vẫn gửi đơn',
  };
}

export interface OrdersReading {
  ok: boolean;
  items: unknown[];
  message: string;
}

/** API 5: lấy các phần tử đơn trong phản hồi danh sách đơn. */
export function readOrderItems(
  spec: IntegrationSpec,
  res: HttpResult,
): OrdersReading {
  if (!res.ok) return { ok: false, items: [], message: res.message };
  const scope = responseScope(res);
  if (!allMatch(successConditions(spec.orders.success), scope)) {
    return {
      ok: false,
      items: [],
      message: messageOf('body.message', scope, res.status),
    };
  }
  const listPath = ordersListPath(spec);
  const items = listAt(scope.body, listPath);
  return items
    ? { ok: true, items, message: '' }
    : {
        ok: false,
        items: [],
        message: `Không thấy danh sách đơn ở ${listPath || '(cả phản hồi)'}`,
      };
}

/** Một đơn phía NCC → dạng tóm tắt, đọc trạng thái theo bảng trạng thái của Hub. */
export function summarizeOrder(
  spec: IntegrationSpec,
  item: unknown,
): SupplierOrderSummary {
  const { result } = mapOrder(item, spec.order, { durationMs: 0 });
  const text = (path: string) =>
    path ? asString(evaluateItem(path, item)) || null : null;
  return {
    transCode: text(spec.orders.matchField),
    supplierTransId: result.supplierTransId ?? null,
    status: text(spec.order.status),
    outcome: result.outcome,
    errorCode: result.error?.code ?? null,
    createdAt: text(spec.orders.createdAt),
  };
}

/** Tra cứu bằng danh sách đơn: tìm đúng đơn theo mã Hub; không thấy là NOT_FOUND. */
export function classifyOrdersLookup(
  spec: IntegrationSpec,
  res: HttpResult,
  transCode: string,
  trace: SupplierTrace,
  supplierTransId: string | null = null,
): Classified {
  if (!res.ok) return transport(res, trace);
  const reading = readOrderItems(spec, res);
  if (!reading.ok) {
    return {
      result: unknownResult(reading.message, trace, `HTTP_${res.status}`),
      explain:
        'Gọi danh sách đơn không thành công: chưa biết kết quả, Hub sẽ tra cứu lại',
    };
  }
  const bySupplierId =
    spec.orders.matchBy === 'SUPPLIER_ID' &&
    Boolean(supplierTransId) &&
    Boolean(spec.order.supplierTransId);
  const key = bySupplierId ? (supplierTransId as string) : transCode;
  const match = reading.items.find((item) =>
    bySupplierId
      ? asString(evaluateItem(spec.order.supplierTransId, item)) === key
      : asString(evaluateItem(spec.orders.matchField, item)) === key,
  );
  if (!match) {
    if (supplierTransId) {
      return {
        result: unknownResult(
          `Danh sách đơn không có đơn ${key}`,
          trace,
          'ORDER_NOT_IN_LIST',
        ),
        explain: `Nhà cung cấp đã nhận đơn (mã ${supplierTransId}) nhưng danh sách chưa có ${key}: chưa rõ, Hub tra cứu lại, không gửi lại đơn`,
      };
    }
    return {
      result: { outcome: Outcome.NOT_FOUND, trace },
      explain: `Danh sách đơn không có ${key}: Hub sẽ gửi lại đơn`,
    };
  }
  const found = mapOrder(match, spec.order, trace);
  return {
    ...found,
    explain: `Tìm thấy đơn theo ${bySupplierId ? 'mã nhà cung cấp' : 'mã đơn Hub'} ${key}. ${found.explain}`,
  };
}

export function classifyTest(
  spec: IntegrationSpec,
  res: HttpResult,
): { ok: boolean; message: string } {
  if (!res.ok) return { ok: false, message: res.message };
  const scope = responseScope(res);
  if (successOrNull(spec.test.success, res)) {
    return { ok: true, message: `Kết nối thành công (HTTP ${res.status})` };
  }
  return {
    ok: false,
    message: `HTTP ${res.status}: ${asString(evaluate('body.message', scope)) || 'phản hồi không đạt điều kiện thành công'}`,
  };
}

export interface CallbackReading {
  eventId: string | undefined;
  transCode: string | undefined;
  accepted: boolean;
  classified: Classified;
}

export function readCallback(
  spec: IntegrationSpec,
  body: unknown,
  headers: Record<string, unknown>,
  trace: SupplierTrace,
): CallbackReading {
  const scope: Scope = { body, headers };
  const accepted = allMatch(spec.callback.accept, scope);
  const order = spec.callback.orderPath
    ? evaluate(spec.callback.orderPath, scope)
    : body;
  return {
    eventId: asString(evaluate(spec.callback.eventId, scope)) || undefined,
    transCode: asString(evaluate(spec.callback.transCode, scope)) || undefined,
    accepted,
    classified: accepted
      ? mapOrder(order, spec.order, trace)
      : {
          result: unknownResult(
            'Callback không thuộc loại được nhận',
            trace,
            'CALLBACK_IGNORED',
          ),
          explain: 'Callback không khớp điều kiện nhận nên bị bỏ qua',
        },
  };
}

/** Che mọi chỗ xuất hiện giá trị bí mật (tên bí mật do người dùng đặt nên không che theo tên được). */
export function maskSecretValues<T>(
  value: T,
  secrets: Record<string, unknown>,
): T {
  const needles = Object.values(secrets)
    .filter(
      (item): item is string => typeof item === 'string' && item.length >= 4,
    )
    .sort((a, b) => b.length - a.length);
  if (needles.length === 0) return value;
  const mask = (text: string) =>
    needles.reduce((acc, needle) => acc.split(needle).join('***'), text);
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return mask(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      return Object.fromEntries(
        Object.entries(node).map(([k, v]) => [k, walk(v)]),
      );
    }
    return node;
  };
  return walk(value) as T;
}
