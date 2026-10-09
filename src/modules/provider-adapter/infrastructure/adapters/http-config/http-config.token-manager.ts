import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { SecretCipherPort } from '@common/crypto/secret-cipher.port';
import { SupplierContext } from '@modules/provider-adapter/domain/provider-adapter.port';
import { TokenStorePort } from '@modules/provider-adapter/domain/token-store.port';
import {
  HttpJsonClient,
  HttpResult,
} from '@modules/provider-adapter/infrastructure/http/http-json.client';
import { HttpConfigParams } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.types';
import {
  BuiltRequest,
  buildRequest,
  readToken,
  requestBaseUrl,
  requestScope,
  signatureRuleFor,
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

/** Token kèm nguồn: dùng lại từ Redis, hay vừa đăng nhập (kèm request/phản hồi đăng nhập). */
export type TokenObtained = TokenReading & {
  fromCache: boolean;
  exchange?: { built: BuiltRequest; res: HttpResult };
};

/**
 * Khoá token theo những gì ảnh hưởng tới đăng nhập (địa chỉ, request đăng nhập, xác thực,
 * header, chữ ký áp cho đăng nhập, biến, bí mật). Sửa phần khác của cấu hình vẫn dùng token cũ;
 * đổi mật khẩu / URL đăng nhập thì tự đăng nhập lại.
 */
export function tokenKey(
  ctx: SupplierContext,
  params: HttpConfigParams,
): string {
  const { spec } = params;
  let base: string;
  try {
    base = requestBaseUrl(spec, spec.token.request, ctx.baseUrl);
  } catch {
    base = `missing:${spec.token.request.host ?? ''}`;
  }
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        base,
        request: spec.token.request,
        tokenPath: spec.token.tokenPath,
        auth: spec.auth,
        headers: spec.headers,
        signature:
          signatureRuleFor(spec, 'login', spec.token.request.method) ?? null,
        vars: params.vars,
        secrets: ctx.secrets,
      }),
    )
    .digest('hex')
    .slice(0, 32);
  return `hub:supplier-token:${ctx.supplierId}:${fingerprint}`;
}

/**
 * Lấy token đăng nhập NCC: dùng lại token đang lưu (mã hoá, dùng chung mọi tiến trình),
 * hết thì đăng nhập lại. Khoá trong Redis để nhiều worker không cùng đăng nhập một lúc.
 * Đổi cấu hình NCC (version mới) thì tự dùng token mới.
 */
@Injectable()
export class TokenManager {
  private readonly inflight = new Map<string, Promise<TokenObtained>>();

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
  ): Promise<TokenObtained> {
    const key = tokenKey(ctx, params);
    const cached = await this.read(key);
    if (cached && cached !== rejected) {
      return {
        ok: true,
        token: cached,
        ttlSec: params.spec.token.ttlSec,
        fromCache: true,
      };
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

  async invalidate(
    ctx: SupplierContext,
    params: HttpConfigParams,
  ): Promise<void> {
    await this.store.delete(tokenKey(ctx, params));
  }

  private async login(
    ctx: SupplierContext,
    params: HttpConfigParams,
    key: string,
    rejected?: string,
  ): Promise<TokenObtained> {
    const lockKey = `${key}:lock`;
    const locked = await this.store.lock(lockKey, LOCK_MS);
    if (!locked) {
      for (let step = 0; step < WAIT_STEPS; step += 1) {
        await sleep(WAIT_STEP_MS);
        const token = await this.read(key);
        if (token && token !== rejected) {
          return {
            ok: true,
            token,
            ttlSec: params.spec.token.ttlSec,
            fromCache: true,
          };
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
      return { ...reading, fromCache: false, exchange: { built, res } };
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
}
