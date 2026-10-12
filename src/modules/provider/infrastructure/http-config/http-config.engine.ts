import { createHash, createHmac, randomUUID } from 'node:crypto';
import {
  CallKind,
  IntegrationSpec,
  ProviderConfig,
  RequestSpec,
  SignatureSpec,
  http2xx,
} from '@modules/provider/domain/provider-config';
import { HttpResult } from '@modules/provider/infrastructure/http/http-json.client';
import {
  allMatch,
  anyMatch,
  asString,
  evaluate,
  isEmpty,
  render,
  renderValue,
  Scope,
  setPath,
} from '@modules/provider/infrastructure/http-config/http-config.template';

const MAX_ERROR_CODE_LENGTH = 50;
const MAX_ERROR_MESSAGE_LENGTH = 500;
/** Đường dẫn ghi đầy đủ `https://...` thì gọi thẳng (vd máy chủ đăng nhập khác máy chủ API). */
const ABSOLUTE_URL = /^https?:\/\//i;
/** Số thuần: không dấu phân cách nghìn, không ký hiệu tiền tệ. */
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

export interface BuiltRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  rawBody?: string;
  /** Body dạng đối tượng để hiển thị (chưa che bí mật). */
  bodyForTrace?: unknown;
  signature?: string;
  /** Đúng chuỗi đã đem ký, để người cấu hình đối chiếu với tài liệu đối tác. */
  signedPayload?: string;
}

const VN_OFFSET_MS = 7 * 3_600_000;

/** Một mốc thời gian ở các dạng hay gặp; `date`/`datetime` theo giờ Việt Nam. */
function timeParts(ms: number) {
  const vn = new Date(ms + VN_OFFSET_MS).toISOString();
  return {
    unix: Math.floor(ms / 1000),
    unixSec: Math.floor(ms / 1000),
    unixMs: ms,
    iso: new Date(ms).toISOString(),
    date: vn.slice(0, 10),
    datetime: `${vn.slice(0, 10)} ${vn.slice(11, 19)}`,
  };
}

/** Phạm vi biến cho một lời gọi. `uuid` và `now` mới cho mỗi lời gọi, dùng chung trong cùng lời gọi. */
export function requestScope(
  config: ProviderConfig,
  secrets: Record<string, string>,
  token: string | null = null,
): Scope {
  return {
    vars: config.vars,
    secrets,
    token: token ?? '',
    uuid: randomUUID(),
    now: timeParts(Date.now()),
  };
}

function typed(value: unknown, type: string): unknown {
  if (isEmpty(value)) return value ?? null;
  if (type === 'number') {
    const num = Number(value);
    return Number.isFinite(num) ? num : asString(value);
  }
  if (type === 'boolean') return asString(value) === 'true';
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

/** Tính chữ ký theo cấu hình. Không phụ thuộc đối tác nào. */
export function computeSignature(
  signature: SignatureSpec,
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

export class UnknownHostError extends Error {
  constructor(readonly key: string) {
    super(`Chưa khai báo Base URL "${key}"`);
  }
}

/** Địa chỉ gốc của một request: Base URL mặc định, hoặc địa chỉ có tên request đã chọn. */
export function requestBaseUrl(
  config: ProviderConfig,
  request: RequestSpec,
): string {
  if (!request.host) return config.baseUrl;
  const host = config.hosts.find((item) => item.key === request.host);
  if (!host?.url) throw new UnknownHostError(request.host);
  return host.url;
}

export function buildRequest(
  spec: IntegrationSpec,
  request: RequestSpec,
  baseUrl: string,
  scope: Scope,
  kind: CallKind,
): BuiltRequest {
  const plainPath = render(request.path, scope);
  const path = render(request.path, scope, encodeURIComponent);
  const url = ABSOLUTE_URL.test(plainPath)
    ? new URL(plainPath)
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

  const sign =
    spec.signature.enabled && spec.signature.apply[kind]
      ? spec.signature
      : null;
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
    ...(signature ? { signature, signedPayload } : {}),
  };
}

type HttpOk = Extract<HttpResult, { ok: true }>;

function responseScope(res: HttpOk): Scope {
  return {
    http: { status: res.status },
    body: res.body ?? res.rawText,
    headers: res.headers ?? {},
  };
}

function messageOf(path: string, scope: Scope, status: number): string {
  const message = path ? asString(evaluate(path, scope)) : '';
  return (message || `HTTP ${status}`).slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

/** UNMAPPED: đăng nhập có phản hồi hợp lệ nhưng chưa khai báo token nằm ở đâu. */
export type TokenReading =
  | { ok: true; token: string; ttlSec: number }
  | {
      ok: false;
      reason: 'TRANSPORT' | 'REJECTED' | 'UNMAPPED';
      message: string;
    };

/** Đọc token từ phản hồi đăng nhập. */
export function readToken(
  spec: IntegrationSpec,
  res: HttpResult,
): TokenReading {
  if (!res.ok) return { ok: false, reason: 'TRANSPORT', message: res.message };
  const scope = responseScope(res);
  const conditions =
    spec.token.success.length > 0 ? spec.token.success : [http2xx()];
  const token = spec.token.tokenPath
    ? asString(evaluate(spec.token.tokenPath, scope))
    : '';
  if (!spec.token.tokenPath && allMatch(conditions, scope)) {
    return {
      ok: false,
      reason: 'UNMAPPED',
      message:
        'Đã nhận phản hồi đăng nhập nhưng chưa khai báo đường dẫn token: hãy chọn trường chứa token trong phản hồi',
    };
  }
  if (!allMatch(conditions, scope) || !token) {
    const message = messageOf('body.message', scope, res.status);
    return {
      ok: false,
      reason: res.status >= 500 ? 'TRANSPORT' : 'REJECTED',
      message: token
        ? message
        : `${message} (không thấy token ở ${spec.token.tokenPath || '(chưa khai báo)'})`,
    };
  }
  const expires = Number(
    spec.token.expiresInPath ? evaluate(spec.token.expiresInPath, scope) : NaN,
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
  if (!spec.token.enabled || !res.ok || spec.token.refreshOn.length === 0) {
    return false;
  }
  return anyMatch(spec.token.refreshOn, responseScope(res));
}

export type BalanceReading =
  | { ok: true; balance: number; rawValue: string }
  | { ok: false; errorCode: string; errorMessage: string };

/**
 * Đọc số dư từ phản hồi. Chỉ nhận số hoặc chuỗi số thuần (không đoán dấu phân cách nghìn);
 * kết quả nhân với hệ số đơn vị để ra VNĐ.
 */
export function readBalance(
  spec: IntegrationSpec,
  res: HttpOk,
  unitMultiplier: number,
): BalanceReading {
  const { balance } = spec;
  const scope = responseScope(res);
  const conditions = balance.success.length > 0 ? balance.success : [http2xx()];
  if (!allMatch(conditions, scope)) {
    const partnerCode = balance.errorCodePath
      ? asString(evaluate(balance.errorCodePath, scope))
      : '';
    return {
      ok: false,
      errorCode: (partnerCode || `HTTP_${res.status}`).slice(
        0,
        MAX_ERROR_CODE_LENGTH,
      ),
      errorMessage: `Đối tác báo không thành công: ${messageOf(balance.errorMessagePath, scope, res.status)}`,
    };
  }
  if (!balance.balancePath) {
    return {
      ok: false,
      errorCode: 'BALANCE_PATH_MISSING',
      errorMessage:
        'Đã nhận phản hồi nhưng chưa khai báo đường dẫn số dư: hãy chọn trường chứa số dư trong phản hồi',
    };
  }
  const value = evaluate(balance.balancePath, scope);
  if (isEmpty(value)) {
    return {
      ok: false,
      errorCode: 'BALANCE_NOT_FOUND',
      errorMessage: `Không tìm thấy số dư ở "${balance.balancePath}" trong phản hồi`,
    };
  }
  const text =
    typeof value === 'number' ? String(value) : asString(value).trim();
  const num = typeof value === 'number' ? value : Number(text);
  if (
    !Number.isFinite(num) ||
    (typeof value !== 'number' && !PLAIN_NUMBER.test(text))
  ) {
    return {
      ok: false,
      errorCode: 'BALANCE_NOT_NUMBER',
      errorMessage: `Giá trị ở "${balance.balancePath}" không phải số thuần: ${text.slice(0, 80)}`,
    };
  }
  return { ok: true, balance: num * unitMultiplier, rawValue: text };
}
