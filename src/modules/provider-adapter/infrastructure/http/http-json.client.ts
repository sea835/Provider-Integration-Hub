import { Injectable } from '@nestjs/common';

export interface HttpRequest {
  method: 'GET' | 'POST';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs: number;
}

export type HttpResult =
  | {
      ok: true;
      status: number;
      body: unknown;
      rawText: string;
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
    try {
      const response = await fetch(req.url, {
        method: req.method,
        headers: {
          Accept: 'application/json',
          ...(req.body !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...req.headers,
        },
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
        signal: AbortSignal.timeout(req.timeoutMs),
      });
      const rawText = await response.text();
      return {
        ok: true,
        status: response.status,
        body: parseJson(rawText),
        rawText,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      return {
        ok: false,
        kind:
          name === 'TimeoutError' || name === 'AbortError'
            ? 'TIMEOUT'
            : 'NETWORK',
        message: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      };
    }
  }
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
