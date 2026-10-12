import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { SecretCipherPort } from '@common/crypto/secret-cipher.port';
import { ProviderConfig } from '@modules/provider/domain/provider-config';
import { TokenStorePort } from '@modules/provider/domain/token-store.port';
import {
  HttpJsonClient,
  HttpResult,
} from '@modules/provider/infrastructure/http/http-json.client';
import {
  BuiltRequest,
  buildRequest,
  readToken,
  requestBaseUrl,
  requestScope,
  TokenReading,
} from '@modules/provider/infrastructure/http-config/http-config.engine';

const SAFETY_MARGIN_SEC = 60;
const MIN_CACHE_SEC = 30;
const LOCK_MS = 15_000;
const WAIT_STEP_MS = 200;
const WAIT_STEPS = 25;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface TokenContext {
  cacheKey: string;
  config: ProviderConfig;
  secrets: Record<string, string>;
  timeoutMs: number;
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
export function tokenKey(ctx: TokenContext): string {
  const { spec } = ctx.config;
  let base: string;
  try {
    base = requestBaseUrl(ctx.config, spec.token.request);
  } catch {
    base = `missing:${spec.token.request.host}`;
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
          spec.signature.enabled && spec.signature.apply.login
            ? spec.signature
            : null,
        vars: ctx.config.vars,
        secrets: ctx.secrets,
      }),
    )
    .digest('hex')
    .slice(0, 32);
  return `hub:provider-token:${ctx.cacheKey}:${fingerprint}`;
}

/**
 * Lấy token đăng nhập đối tác: dùng lại token đang lưu (mã hoá, dùng chung mọi tiến trình),
 * hết thì đăng nhập lại. Khoá trong Redis để nhiều worker không cùng đăng nhập một lúc.
 */
@Injectable()
export class TokenManager {
  private readonly inflight = new Map<string, Promise<TokenObtained>>();

  constructor(
    private readonly http: HttpJsonClient,
    private readonly store: TokenStorePort,
    private readonly cipher: SecretCipherPort,
  ) {}

  /**
   * `rejected`: token vừa bị đối tác từ chối; nếu kho đã có token khác thì dùng luôn.
   * `fresh`: bỏ qua kho, luôn đăng nhập (công cụ Thử kết nối).
   */
  async obtain(
    ctx: TokenContext,
    options: { rejected?: string; fresh?: boolean } = {},
  ): Promise<TokenObtained> {
    const key = tokenKey(ctx);
    if (options.fresh) return this.login(ctx, key, undefined, true);

    const cached = await this.read(key);
    if (cached && cached !== options.rejected) {
      return {
        ok: true,
        token: cached,
        ttlSec: ctx.config.spec.token.ttlSec,
        fromCache: true,
      };
    }
    if (cached) await this.store.delete(key);

    const pending = this.inflight.get(key);
    if (pending) return pending;
    const run = this.login(ctx, key, options.rejected, false).finally(() =>
      this.inflight.delete(key),
    );
    this.inflight.set(key, run);
    return run;
  }

  async invalidate(ctx: TokenContext): Promise<void> {
    await this.store.delete(tokenKey(ctx));
  }

  private async login(
    ctx: TokenContext,
    key: string,
    rejected: string | undefined,
    fresh: boolean,
  ): Promise<TokenObtained> {
    const lockKey = `${key}:lock`;
    const locked = await this.store.lock(lockKey, LOCK_MS);
    if (!locked && !fresh) {
      for (let step = 0; step < WAIT_STEPS; step += 1) {
        await sleep(WAIT_STEP_MS);
        const token = await this.read(key);
        if (token && token !== rejected) {
          return {
            ok: true,
            token,
            ttlSec: ctx.config.spec.token.ttlSec,
            fromCache: true,
          };
        }
      }
    }
    try {
      const { spec } = ctx.config;
      const built = buildRequest(
        spec,
        spec.token.request,
        requestBaseUrl(ctx.config, spec.token.request),
        requestScope(ctx.config, ctx.secrets),
        'login',
      );
      const res = await this.http.request({
        method: built.method as 'GET' | 'POST' | 'PUT',
        url: built.url,
        headers: built.headers,
        rawBody: built.rawBody,
        timeoutMs: ctx.timeoutMs,
      });
      const reading = readToken(spec, res);
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
