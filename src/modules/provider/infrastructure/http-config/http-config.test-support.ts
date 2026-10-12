import { SecretCipherPort } from '@common/crypto/secret-cipher.port';
import { ProviderConfig } from '@modules/provider/domain/provider-config';
import { parseProviderConfig } from '@modules/provider/domain/provider-config.validation';
import { TokenStorePort } from '@modules/provider/domain/token-store.port';
import {
  HttpJsonClient,
  HttpRequest,
  HttpResult,
} from '@modules/provider/infrastructure/http/http-json.client';

export class MemoryTokenStore extends TokenStorePort {
  readonly data = new Map<string, string>();
  readonly locks = new Set<string>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.data.get(key) ?? null);
  }

  set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.data.delete(key);
    return Promise.resolve();
  }

  lock(key: string): Promise<boolean> {
    if (this.locks.has(key)) return Promise.resolve(false);
    this.locks.add(key);
    return Promise.resolve(true);
  }

  unlock(key: string): Promise<void> {
    this.locks.delete(key);
    return Promise.resolve();
  }
}

export class PlainCipher extends SecretCipherPort {
  encrypt(value: Record<string, unknown>): string {
    return `enc:${JSON.stringify(value)}`;
  }

  decrypt(payload: string): Record<string, unknown> {
    return JSON.parse(payload.slice(4)) as Record<string, unknown>;
  }
}

export const okResponse = (body: unknown, status = 200): HttpResult => ({
  ok: true,
  status,
  body,
  rawText: JSON.stringify(body),
  headers: {},
  durationMs: 7,
});

/** HTTP client giả: trả lần lượt kết quả do `respond` quyết định, ghi lại mọi request. */
export function fakeHttp(respond: (req: HttpRequest) => HttpResult): {
  http: HttpJsonClient;
  calls: HttpRequest[];
} {
  const calls: HttpRequest[] = [];
  const http = {
    request: (req: HttpRequest) => {
      calls.push(req);
      return Promise.resolve(respond(req));
    },
  };
  return { http, calls };
}

export function configOf(raw: unknown): ProviderConfig {
  const { config, issues } = parseProviderConfig(raw);
  if (issues.length > 0) throw new Error(issues.join('; '));
  return config;
}
