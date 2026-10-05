import { createHmac, timingSafeEqual } from 'node:crypto';

/** Lệch giờ tối đa giữa hai bên khi kiểm chữ ký (Quy chuẩn API NCC v1, mục 3). */
export const MAX_CLOCK_SKEW_SEC = 300;

function hmacHex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Chữ ký request Hub → NCC: `{timestamp}\n{METHOD}\n{path}\n{body}`. */
export function signRequest(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  rawBody: string,
): string {
  return hmacHex(secret, `${timestamp}\n${method}\n${path}\n${rawBody}`);
}

/** Chữ ký callback NCC → Hub: `{timestamp}\n{body}`. */
export function signCallback(
  secret: string,
  timestamp: string,
  rawBody: string,
): string {
  return hmacHex(secret, `${timestamp}\n${rawBody}`);
}

/** Path dùng để ký: gồm tiền tố của base URL và query string, không gồm scheme/host. */
export function signedPathOf(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

export function isFreshTimestamp(
  timestamp: string,
  nowMs: number = Date.now(),
): boolean {
  const seconds = Number(timestamp);
  return (
    Number.isInteger(seconds) &&
    Math.abs(nowMs / 1000 - seconds) <= MAX_CLOCK_SKEW_SEC
  );
}

export function safeEqual(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
