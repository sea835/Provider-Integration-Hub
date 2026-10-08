import { Injectable } from '@nestjs/common';
import {
  OrderAction,
  OrderActionType,
} from '@modules/provider-adapter/domain/order-action';
import {
  OrderExtraField,
  OrderFieldRules,
} from '@modules/provider-adapter/domain/order-fields';
import {
  AdapterFeatures,
  BalanceResult,
  ConnectionTestResult,
  OrderCommand,
  OrderListResult,
  OrderRange,
  OrderRef,
  PackageCheckCommand,
  PackageCheckResult,
  PackageFilter,
  PackageListResult,
  ParsedCallback,
  ProviderAdapter,
  RawCallback,
  SupplierContext,
} from '@modules/provider-adapter/domain/provider-adapter.port';
import {
  Outcome,
  SUPPLIER_CONFIG_ERROR,
  SupplierResult,
  unknownResult,
} from '@modules/provider-adapter/domain/supplier-result';
import { InvalidCallbackPayloadError } from '@modules/provider-adapter/domain/adapter.errors';
import {
  HttpJsonClient,
  HttpResult,
} from '@modules/provider-adapter/infrastructure/http/http-json.client';
import { traceOf } from '@modules/provider-adapter/infrastructure/http/trace';
import { maskSensitive } from '@common/libs/mask-sensitive';
import {
  CallKind,
  defaultParams,
  HttpConfigParams,
  RequestSpec,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.types';
import { TokenManager } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.token-manager';
import {
  parseParams,
  validateSecrets,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.validation';
import {
  BuiltRequest,
  buildRequest,
  classifyOrdersLookup,
  classifyQuery,
  classifySubmit,
  classifyTest,
  maskSecretValues,
  needsTokenRefresh,
  OrderInput,
  readCallback,
  readCheck,
  readOrderItems,
  readPackages,
  requestScope,
  summarizeOrder,
  TokenReading,
  checkTarget,
  readBalance,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.engine';

class NoConfig {}

interface CallOutcome {
  res: HttpResult;
  trace: ReturnType<typeof traceOf>;
}

type TokenError = { tokenError: Extract<TokenReading, { ok: false }> };

/** Tra cứu bằng danh sách đơn nhìn lại tối đa chừng này (đơn quá cũ đã chuyển đối soát). */
const LOOKUP_WINDOW_MS = 7 * 86_400_000;

/** NCC có API riêng: mọi thứ (đường dẫn, biến, token, cách đọc kết quả) khai báo trên giao diện. */
@Injectable()
export class HttpConfigAdapter implements ProviderAdapter {
  readonly type = 'HTTP_CONFIG';
  readonly meta = {
    label: 'Tự cấu hình',
    description:
      'Nhà cung cấp có API riêng. Tự khai báo đường dẫn, biến, token và cách đọc kết quả ngay trên giao diện, không cần viết code.',
    editor: 'HTTP_CONFIG' as const,
    params: [],
    secrets: [],
  };
  readonly capabilities = {
    actions: [
      OrderAction.BUY_DATA,
      OrderAction.TOPUP,
      OrderAction.ACTIVATE_SIM,
    ],
    callback: true,
  };
  readonly paramsClass = NoConfig;
  readonly secretsClass = NoConfig;

  constructor(
    private readonly http: HttpJsonClient,
    private readonly tokens: TokenManager,
  ) {}

  validateConfig(
    params: Record<string, unknown>,
    secrets: Record<string, unknown> | null,
  ): string[] {
    const parsed = parseParams(params);
    return secrets === null
      ? parsed.issues
      : [
          ...parsed.issues,
          ...validateSecrets(secrets, parsed.params.secretKeys),
        ];
  }

  supportedActions(ctx: SupplierContext): OrderActionType[] {
    return parseParams(ctx.params).params.spec.actions;
  }

  defaultParams(): Record<string, unknown> {
    return defaultParams() as unknown as Record<string, unknown>;
  }

  fieldRules(ctx: SupplierContext): OrderFieldRules {
    return parseParams(ctx.params).params.spec.fields;
  }

  extraFields(ctx: SupplierContext): OrderExtraField[] {
    return parseParams(ctx.params).params.spec.extraFields;
  }

  features(ctx: SupplierContext): AdapterFeatures {
    const { spec } = parseParams(ctx.params).params;
    return {
      packages: spec.packages.enabled && Boolean(spec.packages.request.path),
      check: spec.check.enabled && Boolean(spec.check.request.path),
      checkBeforeSubmit:
        spec.check.enabled &&
        spec.check.beforeSubmit &&
        Boolean(spec.check.request.path),
      orderList: spec.orders.enabled && Boolean(spec.orders.request.path),
      balance: spec.balance.enabled && Boolean(spec.balance.request.path),
      balanceBeforeSubmit:
        spec.balance.enabled &&
        spec.balance.beforeSubmit &&
        Boolean(spec.balance.request.path),
    };
  }

  async checkBalance(
    ctx: SupplierContext,
    cmd: PackageCheckCommand | null = null,
  ): Promise<BalanceResult> {
    const params = parseParams(ctx.params).params;
    const order: OrderInput | null = cmd
      ? { transCode: '', ...cmd, supplierTransId: null }
      : null;
    const outcome = await this.call(
      ctx,
      params,
      'balance',
      params.spec.balance.request,
      order,
      ctx.timeouts.queryMs,
    );
    if ('tokenError' in outcome) {
      return {
        ok: false,
        available: null,
        pending: null,
        currency: null,
        minimum: null,
        sufficient: null,
        message: `Chưa lấy được token: ${outcome.tokenError.message}`,
        trace: { durationMs: 0 },
      };
    }
    return { ...readBalance(params, outcome.res, order), trace: outcome.trace };
  }

  async listPackages(
    ctx: SupplierContext,
    filter: PackageFilter,
  ): Promise<PackageListResult> {
    const params = parseParams(ctx.params).params;
    const order: OrderInput = {
      transCode: '',
      action: filter.action ?? '',
      packageCode: '',
      phone: filter.phone,
      serial: filter.serial,
      supplierTransId: null,
      extra: filter.extra ?? {},
    };
    const outcome = await this.call(
      ctx,
      params,
      'packages',
      params.spec.packages.request,
      order,
      ctx.timeouts.queryMs,
    );
    if ('tokenError' in outcome) {
      return {
        ok: false,
        message: `Chưa lấy được token: ${outcome.tokenError.message}`,
        trace: { durationMs: 0 },
      };
    }
    const reading = readPackages(params.spec, outcome.res);
    return reading.ok
      ? { ok: true, packages: reading.packages, trace: outcome.trace }
      : { ok: false, message: reading.message, trace: outcome.trace };
  }

  async checkPackage(
    ctx: SupplierContext,
    cmd: PackageCheckCommand,
  ): Promise<PackageCheckResult> {
    const params = parseParams(ctx.params).params;
    const order: OrderInput = {
      transCode: '',
      ...cmd,
      supplierTransId: null,
    };
    const outcome = await this.call(
      ctx,
      params,
      'check',
      params.spec.check.request,
      order,
      ctx.timeouts.queryMs,
    );
    if ('tokenError' in outcome) {
      return { eligible: null, reason: null, trace: { durationMs: 0 } };
    }
    const reading = readCheck(
      params.spec,
      outcome.res,
      checkTarget(params, order),
    );
    return {
      eligible: reading.eligible,
      reason: reading.reason,
      trace: outcome.trace,
    };
  }

  async listOrders(
    ctx: SupplierContext,
    range: OrderRange,
  ): Promise<OrderListResult> {
    const params = parseParams(ctx.params).params;
    const outcome = await this.call(
      ctx,
      params,
      'orders',
      params.spec.orders.request,
      null,
      ctx.timeouts.queryMs,
      range,
    );
    if ('tokenError' in outcome) {
      return {
        ok: false,
        message: `Chưa lấy được token: ${outcome.tokenError.message}`,
        trace: { durationMs: 0 },
      };
    }
    const reading = readOrderItems(params.spec, outcome.res);
    return reading.ok
      ? {
          ok: true,
          orders: reading.items.map((item) =>
            summarizeOrder(params.spec, item),
          ),
          trace: outcome.trace,
        }
      : { ok: false, message: reading.message, trace: outcome.trace };
  }

  async submit(
    ctx: SupplierContext,
    cmd: OrderCommand,
  ): Promise<SupplierResult> {
    const params = parseParams(ctx.params).params;
    const blocker = this.submitBlocker(params);
    if (blocker) return this.configFailure(blocker);
    const order: OrderInput = { ...cmd, supplierTransId: null };
    const outcome = await this.call(
      ctx,
      params,
      'submit',
      params.spec.submit.request,
      order,
      ctx.timeouts.submitMs,
    );
    if ('tokenError' in outcome) {
      return outcome.tokenError.reason === 'REJECTED'
        ? this.configFailure(
            `Không đăng nhập được nhà cung cấp: ${outcome.tokenError.message}`,
          )
        : unknownResult(
            `Chưa lấy được token: ${outcome.tokenError.message}`,
            { durationMs: 0 },
            'TOKEN_UNAVAILABLE',
          );
    }
    return classifySubmit(params.spec, outcome.res, outcome.trace).result;
  }

  async query(ctx: SupplierContext, ref: OrderRef): Promise<SupplierResult> {
    const params = parseParams(ctx.params).params;
    const byOrders = params.spec.query.source === 'ORDERS';
    const request = byOrders
      ? params.spec.orders.request
      : params.spec.query.request;
    if (!request.path || (byOrders && !params.spec.orders.enabled)) {
      return unknownResult(
        'Chưa cấu hình tra cứu đơn',
        { durationMs: 0 },
        SUPPLIER_CONFIG_ERROR,
      );
    }
    const order: OrderInput = {
      transCode: ref.transCode,
      action: '',
      packageCode: '',
      phone: null,
      serial: null,
      supplierTransId: ref.supplierTransId,
    };
    const now = Date.now();
    const outcome = await this.call(
      ctx,
      params,
      byOrders ? 'orders' : 'query',
      request,
      order,
      ctx.timeouts.queryMs,
      byOrders
        ? { from: new Date(now - LOOKUP_WINDOW_MS), to: new Date(now) }
        : undefined,
    );
    if ('tokenError' in outcome) {
      return unknownResult(
        `Chưa lấy được token: ${outcome.tokenError.message}`,
        { durationMs: 0 },
        'TOKEN_UNAVAILABLE',
      );
    }
    return byOrders
      ? classifyOrdersLookup(
          params.spec,
          outcome.res,
          ref.transCode,
          outcome.trace,
          ref.supplierTransId,
        ).result
      : classifyQuery(params.spec, outcome.res, ref.transCode, outcome.trace)
          .result;
  }

  async testConnection(ctx: SupplierContext): Promise<ConnectionTestResult> {
    const params = parseParams(ctx.params).params;
    if (!params.spec.test.request.path) {
      return {
        ok: false,
        latencyMs: 0,
        message: 'Chưa cấu hình đường dẫn kiểm tra kết nối',
      };
    }
    const outcome = await this.call(
      ctx,
      params,
      'test',
      params.spec.test.request,
      null,
      ctx.timeouts.queryMs,
    );
    if ('tokenError' in outcome) {
      return {
        ok: false,
        latencyMs: 0,
        message: `Đăng nhập thất bại: ${outcome.tokenError.message}`,
      };
    }
    const tested = classifyTest(params.spec, outcome.res);
    return {
      ...tested,
      message:
        params.spec.token.enabled && tested.ok
          ? `Đăng nhập được. ${tested.message}`
          : tested.message,
      latencyMs: outcome.res.durationMs,
    };
  }

  parseCallback(
    ctx: SupplierContext,
    raw: RawCallback,
  ): Promise<ParsedCallback> {
    const { spec } = parseParams(ctx.params).params;
    if (!spec.callback.enabled) {
      throw new InvalidCallbackPayloadError(
        'Nhà cung cấp này chưa bật nhận callback',
      );
    }
    const reading = readCallback(spec, raw.body, raw.headers, {
      response: maskSensitive(raw.body),
      durationMs: 0,
    });
    if (!reading.eventId) {
      throw new InvalidCallbackPayloadError('Callback thiếu mã sự kiện');
    }
    return Promise.resolve({
      eventId: reading.eventId,
      transCode: reading.accepted ? reading.transCode : undefined,
      supplierTransId: reading.accepted
        ? reading.classified.result.supplierTransId
        : undefined,
      result: reading.classified.result,
    });
  }

  /** Thiếu những phần này thì không gửi đơn đi (an toàn vì NCC chưa nhận gì). */
  private submitBlocker(params: HttpConfigParams): string | null {
    const { spec } = params;
    if (!spec.submit.request.path) return 'Chưa cấu hình gửi đơn';
    const missingHost = [spec.submit.request, spec.token.request].find(
      (request) =>
        request.host &&
        !spec.hosts.some((host) => host.key === request.host && host.url),
    );
    if (
      missingHost &&
      (missingHost !== spec.token.request || spec.token.enabled)
    ) {
      return `Chưa khai báo địa chỉ gốc "${missingHost.host}"`;
    }
    const queryReady =
      spec.query.source === 'ORDERS'
        ? spec.orders.enabled && Boolean(spec.orders.request.path)
        : Boolean(spec.query.request.path);
    if (!queryReady) return 'Chưa cấu hình tra cứu đơn';
    if (
      !spec.order.status ||
      !spec.order.statusMap.some((m) => m.outcome === 'SUCCESS')
    ) {
      return 'Chưa cấu hình cách đọc trạng thái đơn';
    }
    if (
      spec.token.enabled &&
      (!spec.token.request.path || !spec.token.tokenPath)
    ) {
      return 'Chưa cấu hình đăng nhập lấy token';
    }
    return null;
  }

  private configFailure(message: string): SupplierResult {
    return {
      outcome: Outcome.FAILED,
      error: { code: SUPPLIER_CONFIG_ERROR, message },
      trace: { durationMs: 0 },
    };
  }

  /** Gọi NCC; có token thì tự gắn, NCC báo token sai thì lấy token mới và gửi lại đúng một lần. */
  private async call(
    ctx: SupplierContext,
    params: HttpConfigParams,
    kind: CallKind,
    request: RequestSpec,
    order: OrderInput | null,
    timeoutMs: number,
    range?: OrderRange,
  ): Promise<CallOutcome | TokenError> {
    let token: string | null = null;
    if (params.spec.token.enabled) {
      const reading = await this.tokens.obtain(ctx, params);
      if (!reading.ok) return { tokenError: reading };
      token = reading.token;
    }
    const first = await this.send(
      ctx,
      params,
      kind,
      request,
      order,
      token,
      timeoutMs,
      range,
    );
    if (!token || !needsTokenRefresh(params.spec, first.res)) return first;

    const renewed = await this.tokens.obtain(ctx, params, token);
    if (!renewed.ok) return { tokenError: renewed };
    return this.send(
      ctx,
      params,
      kind,
      request,
      order,
      renewed.token,
      timeoutMs,
      range,
    );
  }

  private async send(
    ctx: SupplierContext,
    params: HttpConfigParams,
    kind: CallKind,
    request: RequestSpec,
    order: OrderInput | null,
    token: string | null,
    timeoutMs: number,
    range?: OrderRange,
  ): Promise<CallOutcome> {
    const built: BuiltRequest = buildRequest(
      params.spec,
      request,
      ctx.baseUrl,
      requestScope(params, ctx.secrets, order, { token, range }),
      kind,
    );
    const res = await this.http.request({
      method: built.method as RequestSpec['method'],
      url: built.url,
      headers: built.headers,
      rawBody: built.rawBody,
      timeoutMs,
    });
    const trace = maskSecretValues(
      traceOf(
        {
          method: built.method,
          url: built.url,
          headers: built.headers,
          body: built.bodyForTrace,
        },
        res,
      ),
      token ? { ...ctx.secrets, token } : ctx.secrets,
    );
    return { res, trace };
  }
}
