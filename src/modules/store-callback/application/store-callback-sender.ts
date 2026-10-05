import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { HttpJsonClient } from '@modules/provider-adapter/infrastructure/http/http-json.client';
import { blockedDestination } from '@modules/provider-adapter/infrastructure/http/destination-guard';

export const STORE_CALLBACK_TIMEOUT_MS = 10_000;
const RESPONSE_SNIPPET = 500;

export interface StoreCallbackPayload {
  eventId: string;
  event: string;
  createdAt: string;
  data: unknown;
}

export interface SendResult {
  ok: boolean;
  httpStatus: number | null;
  durationMs: number;
  error: string | null;
  response: string | null;
}

/**
 * Chữ ký: hex(HMAC-SHA256(khoá ký, `${X-Hub-Timestamp}.${body}`)), gửi ở
 * `X-Hub-Signature: sha256=<hex>`. Store tính lại trên body thô để xác thực.
 */
export function signStoreCallback(
  secret: string,
  timestamp: string,
  body: string,
): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}

/** POST một callback về Store. Không throw; Store trả 2xx mới tính là đã nhận. */
@Injectable()
export class StoreCallbackSender {
  constructor(private readonly http: HttpJsonClient) {}

  async send(
    url: string,
    secret: string,
    payload: StoreCallbackPayload,
  ): Promise<SendResult> {
    const blocked = await blockedDestination(url);
    if (blocked) {
      return {
        ok: false,
        httpStatus: null,
        durationMs: 0,
        error: blocked,
        response: null,
      };
    }
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const res = await this.http.request({
      method: 'POST',
      url,
      rawBody: body,
      headers: {
        'User-Agent': 'PhuongQuan-Hub-Callback/1',
        'X-Hub-Event': payload.event,
        'X-Hub-Event-Id': payload.eventId,
        'X-Hub-Timestamp': timestamp,
        'X-Hub-Signature': `sha256=${signStoreCallback(secret, timestamp, body)}`,
      },
      timeoutMs: STORE_CALLBACK_TIMEOUT_MS,
    });
    if (!res.ok) {
      return {
        ok: false,
        httpStatus: null,
        durationMs: res.durationMs,
        error: res.message,
        response: null,
      };
    }
    const delivered = res.status >= 200 && res.status < 300;
    return {
      ok: delivered,
      httpStatus: res.status,
      durationMs: res.durationMs,
      error: delivered
        ? null
        : `Store trả HTTP ${res.status}, cần trả 2xx để xác nhận đã nhận`,
      response: res.rawText ? res.rawText.slice(0, RESPONSE_SNIPPET) : null,
    };
  }
}
