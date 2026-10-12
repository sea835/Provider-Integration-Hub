import { Injectable } from '@nestjs/common';
import { maskSensitive } from '@common/libs/mask-sensitive';
import {
  BalanceProbePort,
  LoginProbeResult,
  ProbeInput,
  ProbeResult,
  ProbeStep,
} from '@modules/provider/domain/balance-probe.port';
import { blockedDestination } from '@modules/provider/infrastructure/http/destination-guard';
import {
  HttpJsonClient,
  HttpResult,
} from '@modules/provider/infrastructure/http/http-json.client';
import {
  BuiltRequest,
  buildRequest,
  needsTokenRefresh,
  readBalance,
  requestBaseUrl,
  requestScope,
} from '@modules/provider/infrastructure/http-config/http-config.engine';
import {
  TokenContext,
  TokenManager,
} from '@modules/provider/infrastructure/http-config/http-config.token-manager';

/** Thời gian chờ tối đa cho mỗi lời gọi tới đối tác. */
export const REQUEST_TIMEOUT_MS = 15_000;
const TRANSIENT_STATUS = new Set([502, 503, 504]);
const MAX_RAW_TEXT = 4000;
const MIN_REDACT_LENGTH = 4;
const MASK = '***';

type Failure = Extract<ProbeResult, { ok: false }>;

class BlockedDestinationError extends Error {}

/** Thay mọi chỗ xuất hiện giá trị bí mật / token trong dữ liệu hiển thị. */
function redact<T>(value: T, hidden: string[]): T {
  if (typeof value === 'string') {
    let text: string = value;
    for (const secret of hidden) text = text.split(secret).join(MASK);
    return text as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item as unknown, hidden)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        redact(item, hidden),
      ]),
    ) as T;
  }
  return value;
}

function previewToken(token: string): string {
  return token.length <= 8
    ? MASK
    : `${token.slice(0, 6)}…(${token.length} ký tự)`;
}

function stepOf(
  kind: ProbeStep['kind'],
  built: BuiltRequest,
  res: HttpResult,
  ok: boolean,
  note: string,
  hidden: string[],
): ProbeStep {
  const request = redact(
    {
      method: built.method,
      url: built.url,
      headers: built.headers,
      ...(built.bodyForTrace !== undefined ? { body: built.bodyForTrace } : {}),
      ...(built.signedPayload !== undefined
        ? { signedPayload: built.signedPayload, signature: built.signature }
        : {}),
    },
    hidden,
  );
  const response = res.ok
    ? {
        status: res.status,
        body: redact(
          maskSensitive(res.body ?? res.rawText.slice(0, MAX_RAW_TEXT)),
          hidden,
        ),
        durationMs: res.durationMs,
      }
    : { error: res.message, durationMs: res.durationMs };
  return { kind, ok, note: redact(note, hidden), request, response };
}

/**
 * Adapter HTTP_CONFIG: đăng nhập lấy token (nếu bật), gọi API số dư, gặp phản hồi báo token
 * hết hạn thì đăng nhập lại và gọi lại đúng một lần.
 */
@Injectable()
export class HttpConfigBalanceProbe extends BalanceProbePort {
  constructor(
    private readonly http: HttpJsonClient,
    private readonly tokens: TokenManager,
  ) {
    super();
  }

  async probe(input: ProbeInput): Promise<ProbeResult> {
    return (await this.execute(input, false)) as ProbeResult;
  }

  async probeLogin(input: ProbeInput): Promise<LoginProbeResult> {
    return this.execute(input, true);
  }

  private async execute(
    input: ProbeInput,
    loginOnly: boolean,
  ): Promise<ProbeResult | LoginProbeResult> {
    const steps: ProbeStep[] = [];
    const hidden = Object.values(input.secrets).filter(
      (value) => value.length >= MIN_REDACT_LENGTH,
    );
    const fail = (
      errorCode: string,
      errorMessage: string,
      extra: Partial<Failure> = {},
    ): Failure => ({
      ok: false,
      errorCode,
      errorMessage: redact(errorMessage, hidden),
      httpStatus: null,
      latencyMs: null,
      transient: false,
      steps,
      tokenPreview: null,
      ...extra,
    });

    try {
      const { config } = input;
      const { spec } = config;
      const tokenContext: TokenContext = {
        cacheKey: input.cacheKey,
        config,
        secrets: input.secrets,
        timeoutMs: REQUEST_TIMEOUT_MS,
      };

      let token: string | null = null;
      let loginResponse: HttpResult | undefined;
      const login = async (options: {
        rejected?: string;
        fresh?: boolean;
      }): Promise<Failure | null> => {
        const loginRequest = buildRequest(
          spec,
          spec.token.request,
          requestBaseUrl(config, spec.token.request),
          requestScope(config, input.secrets),
          'login',
        );
        const blocked = await blockedDestination(loginRequest.url);
        if (blocked) return fail('BLOCKED_DESTINATION', blocked);
        const obtained = await this.tokens.obtain(tokenContext, options);
        loginResponse = obtained.exchange?.res;
        if (obtained.ok) {
          token = obtained.token;
          hidden.push(obtained.token);
        }
        if (obtained.exchange) {
          steps.push(
            stepOf(
              'login',
              obtained.exchange.built,
              obtained.exchange.res,
              obtained.ok || obtained.reason === 'UNMAPPED',
              obtained.ok
                ? `Lấy được token, dùng trong ${obtained.ttlSec} giây`
                : obtained.message,
              hidden,
            ),
          );
        }
        if (obtained.ok) return null;
        const res = obtained.exchange?.res;
        if (obtained.reason === 'UNMAPPED') {
          return fail('TOKEN_PATH_MISSING', obtained.message, {
            httpStatus: res?.ok ? res.status : null,
            latencyMs: res?.durationMs ?? null,
          });
        }
        return fail(
          obtained.reason === 'TRANSPORT'
            ? 'LOGIN_UNREACHABLE'
            : 'LOGIN_FAILED',
          `Đăng nhập thất bại: ${obtained.message}`,
          {
            httpStatus: res?.ok ? res.status : null,
            latencyMs: res?.durationMs ?? null,
            transient: obtained.reason === 'TRANSPORT',
          },
        );
      };

      if (loginOnly && !spec.token.enabled) {
        return fail('LOGIN_DISABLED', 'Chưa bật Đăng nhập lấy token');
      }
      if (spec.token.enabled) {
        const failure = await login({ fresh: input.freshLogin || loginOnly });
        if (failure) return failure;
      }
      if (loginOnly) {
        return {
          ok: true,
          httpStatus: loginResponse?.ok ? loginResponse.status : null,
          latencyMs: loginResponse?.durationMs ?? null,
          steps,
          tokenPreview: token ? previewToken(token) : null,
        };
      }

      const call = async (): Promise<{
        built: BuiltRequest;
        res: HttpResult;
      }> => {
        const built = buildRequest(
          spec,
          spec.balance.request,
          requestBaseUrl(config, spec.balance.request),
          requestScope(config, input.secrets, token),
          'balance',
        );
        const blocked = await blockedDestination(built.url);
        if (blocked) throw new BlockedDestinationError(blocked);
        const res = await this.http.request({
          method: built.method as 'GET' | 'POST' | 'PUT',
          url: built.url,
          headers: built.headers,
          rawBody: built.rawBody,
          timeoutMs: REQUEST_TIMEOUT_MS,
        });
        return { built, res };
      };

      let { built, res } = await call();
      if (needsTokenRefresh(spec, res) && token) {
        steps.push(
          stepOf(
            'balance',
            built,
            res,
            false,
            'Đối tác báo token hết hạn: đăng nhập lại rồi gọi lại một lần',
            hidden,
          ),
        );
        const failure = await login({ rejected: token });
        if (failure) return failure;
        ({ built, res } = await call());
      }

      const tokenPreview = token ? previewToken(token) : null;
      if (!res.ok) {
        steps.push(stepOf('balance', built, res, false, res.message, hidden));
        return fail(res.kind, res.message, {
          latencyMs: res.durationMs,
          transient: true,
          tokenPreview,
        });
      }

      const reading = readBalance(spec, res, input.unitMultiplier);
      if (!reading.ok) {
        steps.push(
          stepOf(
            'balance',
            built,
            res,
            reading.errorCode === 'BALANCE_PATH_MISSING',
            reading.errorMessage,
            hidden,
          ),
        );
        return fail(reading.errorCode, reading.errorMessage, {
          httpStatus: res.status,
          latencyMs: res.durationMs,
          transient: TRANSIENT_STATUS.has(res.status),
          tokenPreview,
        });
      }

      steps.push(
        stepOf(
          'balance',
          built,
          res,
          true,
          `Đọc được số dư ${reading.rawValue} × ${input.unitMultiplier} = ${reading.balance}`,
          hidden,
        ),
      );
      return {
        ok: true,
        balance: reading.balance,
        rawValue: reading.rawValue,
        httpStatus: res.status,
        latencyMs: res.durationMs,
        steps,
        tokenPreview,
      };
    } catch (error) {
      if (error instanceof BlockedDestinationError) {
        return fail('BLOCKED_DESTINATION', error.message);
      }
      return fail(
        'CONFIG_ERROR',
        `Cấu hình không dựng được request: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
