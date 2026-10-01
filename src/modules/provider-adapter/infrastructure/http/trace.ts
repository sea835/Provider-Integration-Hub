import { maskSensitive } from '@common/libs/mask-sensitive';
import { SupplierTrace } from '@modules/provider-adapter/domain/supplier-result';
import { HttpResult } from '@modules/provider-adapter/infrastructure/http/http-json.client';

const MAX_RAW_TEXT = 2000;

/** Dựng trace (đã che dữ liệu nhạy cảm) để lưu vào transaction_events. */
export function traceOf(request: unknown, res: HttpResult): SupplierTrace {
  if (!res.ok) {
    return {
      request: maskSensitive(request),
      response: { error: res.kind, message: res.message },
      durationMs: res.durationMs,
    };
  }
  return {
    request: maskSensitive(request),
    response: maskSensitive(res.body ?? res.rawText.slice(0, MAX_RAW_TEXT)),
    httpStatus: res.status,
    durationMs: res.durationMs,
  };
}

export function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

/** Đọc chuỗi từ dữ liệu không kiểu (secrets, params, JSON của NCC). */
export function asText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}
