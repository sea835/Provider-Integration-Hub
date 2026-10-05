import { Injectable } from '@nestjs/common';

export interface HttpRequest {
  method: 'GET' | 'POST' | 'PUT';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  /** Body đã serialize sẵn, gửi nguyên văn (dùng khi chữ ký tính trên chuỗi body). */
  rawBody?: string;
  timeoutMs: number;
}

export type HttpResult =
  | {
      ok: true;
      status: number;
      body: unknown;
      rawText: string;
      headers?: Record<string, string>;
      durationMs: number;
    }
  | {
      ok: false;
      kind: 'TIMEOUT' | 'NETWORK';
      message: string;
      durationMs: number;
    };

/**
 * HTTP JSON client cho adapter. Không bao giờ throw:
 * lỗi mạng / timeout trả về `ok: false`, HTTP non-2xx vẫn là `ok: true` kèm status.
 */
@Injectable()
export class HttpJsonClient {
  async request(req: HttpRequest): Promise<HttpResult> {
    const startedAt = Date.now();
    const payload =
      req.rawBody ??
      (req.body !== undefined ? JSON.stringify(req.body) : undefined);
    try {
      const response = await fetch(req.url, {
        method: req.method,
        headers: {
          Accept: 'application/json',
          ...(payload !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...req.headers,
        },
        body: payload,
        signal: AbortSignal.timeout(req.timeoutMs),
      });
      const rawText = await response.text();
      return {
        ok: true,
        status: response.status,
        body: parseJson(rawText),
        rawText,
        headers: Object.fromEntries(response.headers.entries()),
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      const name = errorField(error, 'name');
      const timeout = name === 'TimeoutError' || name === 'AbortError';
      return {
        ok: false,
        kind: timeout ? 'TIMEOUT' : 'NETWORK',
        message: timeout
          ? `Hết thời gian chờ ${req.timeoutMs} ms`
          : networkMessage(error, req.url),
        durationMs: Date.now() - startedAt,
      };
    }
  }
}

const NETWORK_REASONS: Record<string, string> = {
  ECONNREFUSED: 'máy chủ từ chối kết nối (sai cổng hoặc dịch vụ chưa chạy)',
  ENOTFOUND: 'không tìm thấy tên miền',
  EAI_AGAIN: 'không phân giải được tên miền (lỗi DNS tạm thời)',
  ECONNRESET: 'kết nối bị ngắt giữa chừng',
  UND_ERR_SOCKET: 'kết nối bị ngắt giữa chừng',
  EHOSTUNREACH: 'không tới được máy chủ (mạng hoặc tường lửa chặn)',
  ENETUNREACH: 'không có đường mạng tới máy chủ',
  ETIMEDOUT: 'quá thời gian chờ mở kết nối',
  UND_ERR_CONNECT_TIMEOUT: 'quá thời gian chờ mở kết nối',
  CERT_HAS_EXPIRED: 'chứng chỉ HTTPS của máy chủ đã hết hạn',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'chứng chỉ HTTPS tự ký, không được tin cậy',
  SELF_SIGNED_CERT_IN_CHAIN: 'chứng chỉ HTTPS tự ký, không được tin cậy',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'không xác minh được chứng chỉ HTTPS',
  ERR_TLS_CERT_ALTNAME_INVALID: 'chứng chỉ HTTPS không khớp tên miền',
  EPROTO: 'lỗi giao thức (có thể gọi https vào cổng http hoặc ngược lại)',
  ERR_SSL_WRONG_VERSION_NUMBER:
    'lỗi giao thức (có thể gọi https vào cổng http hoặc ngược lại)',
};

/** Không dùng instanceof: DOMException (timeout) có thể đến từ realm khác. */
function errorField(error: unknown, field: 'name' | 'message'): string {
  if (!error || typeof error !== 'object' || !(field in error)) return '';
  const value = (error as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : '';
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const { code, cause, errors } = error as {
    code?: unknown;
    cause?: unknown;
    errors?: unknown;
  };
  if (typeof code === 'string' && code !== 'UND_ERR') return code;
  if (Array.isArray(errors) && errors.length > 0) return errorCode(errors[0]);
  return cause ? errorCode(cause) : undefined;
}

/** `fetch failed` của Node không nói lý do; lấy mã lỗi gốc để người vận hành biết phải sửa gì. */
function networkMessage(error: unknown, url: string): string {
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    host = url;
  }
  const code = errorCode(error);
  const reason = code ? NETWORK_REASONS[code] : undefined;
  if (reason) return `Không kết nối được tới ${host}: ${reason} [${code}]`;
  const detail = errorField(error, 'message') || String(error);
  return `Không kết nối được tới ${host}: ${code ? `${detail} [${code}]` : detail}`;
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
