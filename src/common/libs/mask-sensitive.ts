const SENSITIVE_KEY =
  /(secret|password|passwd|api[-_]?key|token|private[-_]?key|signature|^sign$|^lpa$|authorization)/i;

const MASK = '***';

/**
 * Trả về bản sao đã che các trường nhạy cảm (secret, password, api key, chữ ký, LPA...).
 * Dùng trước khi ghi log hoặc lưu payload của NCC vào DB.
 */
export function maskSensitive<T>(value: T, depth = 0): T {
  if (depth > 8 || value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return (value as unknown[]).map((item) =>
      maskSensitive(item, depth + 1),
    ) as T;
  }

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      output[key] =
        SENSITIVE_KEY.test(key) && item !== null && item !== undefined
          ? MASK
          : maskSensitive(item, depth + 1);
    }
    return output as T;
  }

  return value;
}
