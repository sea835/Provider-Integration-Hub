import { Injectable } from '@nestjs/common';
import { SecretCipherPort } from '@common/crypto/secret-cipher.port';
import { SupplierContext } from '@modules/provider-adapter/domain/provider-adapter.port';
import { TokenStorePort } from '@modules/provider-adapter/domain/token-store.port';
import { HttpJsonClient } from '@modules/provider-adapter/infrastructure/http/http-json.client';
import { HttpConfigParams } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.types';
import {
  buildRequest,
  readToken,
  requestScope,
  TokenReading,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.engine';

const SAFETY_MARGIN_SEC = 60;
const MIN_CACHE_SEC = 30;
const LOCK_MS = 15_000;
const WAIT_STEP_MS = 200;
const WAIT_STEPS = 25;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Lấy token đăng nhập NCC: dùng lại token đang lưu (mã hoá, dùng chung mọi tiến trình),
 * hết thì đăng nhập lại. Khoá trong Redis để nhiều worker không cùng đăng nhập một lúc.
 * Đổi cấu hình NCC (version mới) thì tự dùng token mới.
 */
@Injectable()
export class TokenManager {
  private readonly inflight = new Map<string, Promise<TokenReading>>();

  constructor(
    private readonly http: HttpJsonClient,
    private readonly store: TokenStorePort,
    private readonly cipher: SecretCipherPort,
  ) {}

  /** `rejected`: token vừa bị NCC từ chối; nếu kho đã có token khác thì dùng luôn. */
  async obtain(
    ctx: SupplierContext,
    params: HttpConfigParams,
    rejected?: string,
  ): Promise<TokenReading> {
    const key = this.keyOf(ctx);
    const cached = await this.read(key);
    if (cached && cached !== rejected) {
      return { ok: true, token: cached, ttlSec: params.spec.token.ttlSec };
    }
    if (cached) await this.store.delete(key);

    const pending = this.inflight.get(key);
    if (pending) return pending;
    const run = this.login(ctx, params, key, rejected).finally(() =>
      this.inflight.delete(key),
    );
    this.inflight.set(key, run);
    return run;
  }

  async invalidate(ctx: SupplierContext): Promise<void> {
    await this.store.delete(this.keyOf(ctx));
  }

  private async login(
    ctx: SupplierContext,
    params: HttpConfigParams,
    key: string,
    rejected?: string,
  ): Promise<TokenReading> {
    const lockKey = `${key}:lock`;
    const locked = await this.store.lock(lockKey, LOCK_MS);
    if (!locked) {
      for (let step = 0; step < WAIT_STEPS; step += 1) {
        await sleep(WAIT_STEP_MS);
        const token = await this.read(key);
        if (token && token !== rejected) {
          return { ok: true, token, ttlSec: params.spec.token.ttlSec };
        }
      }
    }
    try {
      const built = buildRequest(
        params.spec,
        params.spec.token.request,
        ctx.baseUrl,
        requestScope(params, ctx.secrets, null),
        'login',
      );
      const res = await this.http.request({
        method: built.method as 'GET' | 'POST' | 'PUT',
        url: built.url,
        headers: built.headers,
        rawBody: built.rawBody,
        timeoutMs: ctx.timeouts.queryMs,
      });
      const reading = readToken(params.spec, res);
      if (reading.ok) {
        await this.store.set(
          key,
          this.cipher.encrypt({ token: reading.token }),
          Math.max(MIN_CACHE_SEC, reading.ttlSec - SAFETY_MARGIN_SEC),
        );
      }
      return reading;
    } finally {
      if (locked) await this.store.unlock(lockKey);
    }
  }

  private async read(key: string): Promise<string | null> {
    const stored = await this.store.get(key);
    if (!stored) return null;
    try {
      const token = this.cipher.decrypt(stored).token;
      return typeof token === 'string' ? token : null;
    } catch {
      return null;
    }
  }

  private keyOf(ctx: SupplierContext): string {
    return `hub:supplier-token:${ctx.supplierId}:${ctx.configVersion}`;
  }
}
