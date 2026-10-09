import { Injectable } from '@nestjs/common';
import { LoggerPort, LogLayer } from '@common/logger';
import {
  OrderRange,
  SupplierContext,
  SupplierOrderSummary,
  SupplierPackage,
} from '@modules/provider-adapter/domain/provider-adapter.port';
import { AdapterRegistry } from '@modules/provider-adapter/application/adapter-registry';
import {
  HttpJsonClient,
  HttpResult,
} from '@modules/provider-adapter/infrastructure/http/http-json.client';
import { blockedDestination } from '@modules/provider-adapter/infrastructure/http/destination-guard';
import {
  TokenManager,
  TokenObtained,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.token-manager';
import { parseParams } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.validation';
import {
  BuiltRequest,
  buildRequest,
  classifyOrdersLookup,
  classifyQuery,
  classifyTest,
  Classified,
  maskSecretValues,
  OrderInput,
  readCheck,
  readOrderItems,
  readPackages,
  requestScope,
  summarizeOrder,
  UnknownHostError,
  checkTarget,
  readBalance,
  needsTokenRefresh,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.engine';
import {
  CallKind,
  HttpConfigParams,
  RequestSpec,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.types';
import {
  PreviewResult,
  toPreviewResult,
} from '@modules/provider-adapter/application/integration-preview.service';

export const LIVE_CALL_KINDS = [
  'PACKAGES',
  'CHECK',
  'BALANCE',
  'QUERY',
  'ORDERS',
  'TEST',
] as const;
export type LiveCallKind = (typeof LIVE_CALL_KINDS)[number];

export interface LiveCallInput {
  ctx: SupplierContext;
  adapterType: string;
  params: Record<string, unknown>;
  kind: LiveCallKind;
  order?: Record<string, unknown>;
  /** Khoảng thời gian (ISO) cho API danh sách đơn. */
  range?: { from?: unknown; to?: unknown };
  /** Bí mật đang nhập dở trên giao diện (chưa lưu); thiếu thì dùng bí mật đã lưu. */
  secrets?: Record<string, unknown>;
}

export interface SupplierOrdersOutput {
  supported: boolean;
  ok: boolean;
  message: string | null;
  orders: SupplierOrderSummary[];
  durationMs: number;
}

export interface LiveExchange {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: unknown;
  };
  response:
    | {
        ok: true;
        httpStatus: number;
        durationMs: number;
        headers: Record<string, string>;
        body: unknown;
        truncated: boolean;
      }
    | {
        ok: false;
        error: 'TIMEOUT' | 'NETWORK';
        message: string;
        durationMs: number;
      };
}

export interface LiveCallOutput {
  issues: string[];
  login: (LiveExchange & { ok: boolean; message: string | null }) | null;
  /** true: dùng lại token đã lưu trong Redis, không đăng nhập lại. */
  tokenReused?: boolean;
  call: LiveExchange | null;
  result: PreviewResult | null;
  explain: string | null;
  packages?: SupplierPackage[];
  check?: {
    eligible: boolean | null;
    reason: { code: string; message: string } | null;
  };
  orders?: SupplierOrderSummary[];
  balance?: BalanceView;
}

export interface BalanceView {
  available: number | null;
  pending: number | null;
  currency: string | null;
  minimum: number | null;
  sufficient: boolean | null;
}

export interface SupplierBalanceOutput extends BalanceView {
  supported: boolean;
  ok: boolean;
  message: string;
  durationMs: number;
  checkedAt: string;
}

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 31;

const KIND_LABELS: Record<LiveCallKind, string> = {
  PACKAGES: 'danh sách gói',
  CHECK: 'kiểm tra gói',
  BALANCE: 'số dư',
  QUERY: 'tra cứu đơn',
  ORDERS: 'danh sách đơn',
  TEST: 'kiểm tra kết nối',
};

function dateOf(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Khoảng thời gian hợp lệ (tối đa 31 ngày); thiếu thì lấy 24 giờ gần nhất. */
export function rangeOf(raw?: {
  from?: unknown;
  to?: unknown;
}): OrderRange | string {
  const to = dateOf(raw?.to) ?? new Date();
  const from = dateOf(raw?.from) ?? new Date(to.getTime() - DAY_MS);
  if (from.getTime() > to.getTime())
    return 'Thời điểm bắt đầu phải trước thời điểm kết thúc';
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    return `Khoảng thời gian tối đa ${MAX_RANGE_DAYS} ngày`;
  }
  return { from, to };
}

function result(
  outcome: string,
  errorMessage: string | null = null,
): PreviewResult {
  return {
    outcome,
    errorCode: null,
    errorMessage,
    supplierTransId: null,
    delivery: null,
    retryAfterSec: null,
  };
}

const MAX_BODY_CHARS = 200_000;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * "Gọi thử" cho NCC Tự cấu hình: gọi thật API chỉ đọc (GET tra cứu, GET kiểm tra kết nối)
 * bằng bản tích hợp đang sửa, trả nguyên phản hồi (đã che bí mật) và cách Hub hiểu phản hồi đó.
 * Không bao giờ gửi đơn; token lấy mới riêng cho lần gọi thử, không đụng token đang dùng cho đơn thật.
 */
@Injectable()
export class IntegrationCallService {
  private readonly logger: LoggerPort;

  constructor(
    private readonly http: HttpJsonClient,
    private readonly adapters: AdapterRegistry,
    private readonly tokens: TokenManager,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.APPLICATION,
      'ProviderAdapter',
      IntegrationCallService.name,
    );
  }

  /** Admin xem đơn phía NCC (API danh sách đơn) bằng cấu hình đã lưu. */
  async supplierOrders(
    ctx: SupplierContext,
    adapterType: string,
    rawRange?: { from?: unknown; to?: unknown },
  ): Promise<SupplierOrdersOutput> {
    const adapter = this.adapters.get(adapterType);
    const none = (supported: boolean, message: string) => ({
      supported,
      ok: false,
      message,
      orders: [],
      durationMs: 0,
    });
    if (!adapter.listOrders || !adapter.features?.(ctx).orderList) {
      return none(false, 'Nhà cung cấp này chưa khai báo API danh sách đơn');
    }
    const range = rangeOf(rawRange);
    if (typeof range === 'string') return none(true, range);
    const listed = await adapter.listOrders(ctx, range);
    return listed.ok
      ? {
          supported: true,
          ok: true,
          message: null,
          orders: listed.orders,
          durationMs: listed.trace.durationMs,
        }
      : {
          supported: !listed.unsupported,
          ok: false,
          message: listed.message,
          orders: [],
          durationMs: listed.trace.durationMs,
        };
  }

  /** Admin xem số dư đại lý tại NCC bằng cấu hình đã lưu. */
  async supplierBalance(
    ctx: SupplierContext,
    adapterType: string,
  ): Promise<SupplierBalanceOutput> {
    const adapter = this.adapters.get(adapterType);
    const checkedAt = new Date().toISOString();
    const empty = {
      available: null,
      pending: null,
      currency: null,
      minimum: null,
      sufficient: null,
    };
    if (!adapter.checkBalance || !adapter.features?.(ctx).balance) {
      return {
        ...empty,
        supported: false,
        ok: false,
        message: 'Nhà cung cấp này chưa khai báo API số dư',
        durationMs: 0,
        checkedAt,
      };
    }
    const balance = await adapter.checkBalance(ctx, null);
    this.logger.info('Xem số dư nhà cung cấp', {
      supplier: ctx.supplierCode,
      ok: balance.ok,
      sufficient: balance.sufficient,
    });
    return {
      supported: true,
      ok: balance.ok,
      message: balance.message,
      available: balance.available,
      pending: balance.pending,
      currency: balance.currency,
      minimum: balance.minimum,
      sufficient: balance.sufficient,
      durationMs: balance.trace.durationMs,
      checkedAt,
    };
  }

  async call(input: LiveCallInput): Promise<LiveCallOutput> {
    const fail = (issues: string[]): LiveCallOutput => ({
      issues,
      login: null,
      call: null,
      result: null,
      explain: null,
    });
    if (input.adapterType !== 'HTTP_CONFIG') {
      return fail(['Gọi thử chỉ dùng cho nhà cung cấp loại Tự cấu hình']);
    }
    const { params, issues } = parseParams(input.params);
    if (issues.length > 0) return fail(issues);

    const { spec } = params;
    const label = KIND_LABELS[input.kind];
    const queryByOrders =
      input.kind === 'QUERY' && spec.query.source === 'ORDERS';
    const target: { request: RequestSpec; kind: CallKind } = {
      PACKAGES: { request: spec.packages.request, kind: 'packages' as const },
      CHECK: { request: spec.check.request, kind: 'check' as const },
      BALANCE: { request: spec.balance.request, kind: 'balance' as const },
      QUERY: queryByOrders
        ? { request: spec.orders.request, kind: 'orders' as const }
        : { request: spec.query.request, kind: 'query' as const },
      ORDERS: { request: spec.orders.request, kind: 'orders' as const },
      TEST: { request: spec.test.request, kind: 'test' as const },
    }[input.kind];
    const { request } = target;
    if (!request.path) {
      return fail([
        queryByOrders
          ? 'Tra cứu bằng danh sách đơn: chưa nhập đường dẫn API danh sách đơn'
          : `Chưa nhập đường dẫn ${label}`,
      ]);
    }
    if (input.kind === 'CHECK') {
      const submit = spec.submit.request;
      if (submit.method === request.method && submit.path === request.path) {
        return fail([
          'API kiểm tra gói đang trùng API gửi đơn; gọi thử sẽ tạo đơn thật nên không gọi',
        ]);
      }
    } else if (request.method !== 'GET') {
      return fail([
        `Chỉ gọi thử được request GET; ${label} đang là ${request.method} nên có thể làm thay đổi dữ liệu phía nhà cung cấp`,
      ]);
    }

    const secrets = { ...input.ctx.secrets, ...this.draftSecrets(input) };
    const order: OrderInput = {
      transCode: text(input.order?.transCode) ?? '',
      action: text(input.order?.action) ?? '',
      packageCode: text(input.order?.packageCode) ?? '',
      phone: text(input.order?.phone),
      serial: text(input.order?.serial),
      supplierTransId: text(input.order?.supplierTransId),
      extra:
        input.order?.extra &&
        typeof input.order.extra === 'object' &&
        !Array.isArray(input.order.extra)
          ? (input.order.extra as Record<string, unknown>)
          : {},
    };
    if (input.kind === 'QUERY' && !order.transCode) {
      return fail(['Nhập mã đơn của Hub để tra cứu']);
    }
    if (input.kind === 'CHECK' && !order.packageCode) {
      return fail(['Nhập mã gói cần kiểm tra']);
    }
    let range: OrderRange | undefined;
    if (target.kind === 'orders') {
      const parsed = queryByOrders
        ? { from: new Date(Date.now() - 7 * DAY_MS), to: new Date() }
        : rangeOf(input.range);
      if (typeof parsed === 'string') return fail([parsed]);
      range = parsed;
    }

    let token: string | null = null;
    let login: LiveCallOutput['login'] = null;
    let tokenReused = false;
    const tokenCtx = { ...input.ctx, secrets };
    const loginOf = (obtained: TokenObtained): LiveCallOutput['login'] =>
      obtained.exchange
        ? {
            ...this.exchange(
              obtained.exchange.built,
              obtained.exchange.res,
              secrets,
              obtained.ok ? obtained.token : null,
            ),
            ok: obtained.ok,
            message: obtained.ok ? null : obtained.message,
          }
        : null;
    if (spec.token.enabled) {
      if (!spec.token.request.path) {
        return fail(['Đăng nhập lấy token: chưa nhập đường dẫn đăng nhập']);
      }
      const loginBlocked = await this.loginBlocked(tokenCtx, params);
      if (loginBlocked) return fail([loginBlocked]);
      const obtained = await this.tokens.obtain(tokenCtx, params);
      login = loginOf(obtained);
      tokenReused = obtained.fromCache;
      if (!obtained.ok) {
        return {
          issues: [],
          login,
          call: null,
          result: null,
          explain: `Đăng nhập không lấy được token: ${obtained.message}`,
        };
      }
      token = obtained.token;
    }

    const sent = await this.send(
      input.ctx,
      params,
      secrets,
      request,
      order,
      token,
      target.kind,
      range,
    );
    if ('blocked' in sent) return fail([sent.blocked]);
    let final = sent;
    if (token && needsTokenRefresh(spec, sent.res)) {
      const renewed = await this.tokens.obtain(tokenCtx, params, token);
      login = loginOf(renewed) ?? login;
      tokenReused = false;
      if (renewed.ok) {
        token = renewed.token;
        const again = await this.send(
          input.ctx,
          params,
          secrets,
          request,
          order,
          token,
          target.kind,
          range,
        );
        if ('blocked' in again) return fail([again.blocked]);
        final = again;
      }
    }
    const call = this.exchange(final.built, final.res, secrets, token);
    const res = final.res;

    this.logger.info('Gọi thử nhà cung cấp', {
      supplier: input.ctx.supplierCode,
      kind: input.kind,
      host: new URL(final.built.url).host,
      tokenReused,
      httpStatus: res.ok ? res.status : res.kind,
    });

    const base = { issues: [], login, call, tokenReused };
    switch (input.kind) {
      case 'TEST': {
        const tested = classifyTest(spec, res);
        return {
          ...base,
          result: result(
            tested.ok ? 'OK' : 'FAIL',
            tested.ok ? null : tested.message,
          ),
          explain: tested.message,
        };
      }
      case 'PACKAGES': {
        const reading = readPackages(spec, res);
        return {
          ...base,
          result: result(
            reading.ok ? 'OK' : 'FAIL',
            reading.ok ? null : reading.message,
          ),
          explain: reading.explain,
          packages: reading.packages,
        };
      }
      case 'CHECK': {
        const reading = readCheck(spec, res, checkTarget(params, order));
        return {
          ...base,
          result: result(
            reading.eligible === true
              ? 'ELIGIBLE'
              : reading.eligible === false
                ? 'INELIGIBLE'
                : 'UNKNOWN',
            reading.reason?.message ?? null,
          ),
          explain: reading.explain,
          check: { eligible: reading.eligible, reason: reading.reason },
        };
      }
      case 'BALANCE': {
        const reading = readBalance(params, res, order);
        return {
          ...base,
          result: result(
            reading.sufficient === true
              ? 'SUFFICIENT'
              : reading.sufficient === false
                ? 'INSUFFICIENT'
                : 'UNKNOWN',
            reading.ok ? null : reading.message,
          ),
          explain: reading.message,
          balance: {
            available: reading.available,
            pending: reading.pending,
            currency: reading.currency,
            minimum: reading.minimum,
            sufficient: reading.sufficient,
          },
        };
      }
      case 'ORDERS': {
        const reading = readOrderItems(spec, res);
        const orders = reading.items.map((item) => summarizeOrder(spec, item));
        return {
          ...base,
          result: result(
            reading.ok ? 'OK' : 'FAIL',
            reading.ok ? null : reading.message,
          ),
          explain: reading.ok
            ? `Đọc được ${orders.length} đơn`
            : reading.message,
          orders,
        };
      }
      case 'QUERY': {
        const trace = { durationMs: 0 };
        const classified: Classified = queryByOrders
          ? classifyOrdersLookup(
              spec,
              res,
              order.transCode,
              trace,
              order.supplierTransId,
            )
          : classifyQuery(spec, res, order.transCode, trace);
        return {
          ...base,
          result: toPreviewResult(classified.result),
          explain: classified.explain,
        };
      }
    }
  }

  private draftSecrets(input: LiveCallInput): Record<string, string> {
    return Object.fromEntries(
      Object.entries(input.secrets ?? {}).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === 'string' && entry[1].length > 0,
      ),
    );
  }

  private async send(
    ctx: SupplierContext,
    params: HttpConfigParams,
    secrets: Record<string, unknown>,
    request: RequestSpec,
    order: OrderInput | null,
    token: string | null,
    kind: CallKind,
    range?: OrderRange,
  ): Promise<{ built: BuiltRequest; res: HttpResult } | { blocked: string }> {
    let built: BuiltRequest;
    try {
      built = buildRequest(
        params.spec,
        request,
        ctx.baseUrl,
        requestScope(params, secrets, order, { token, range }),
        kind,
      );
    } catch (error) {
      return {
        blocked:
          error instanceof UnknownHostError
            ? error.message
            : 'Địa chỉ API (Base URL) hoặc đường dẫn không hợp lệ',
      };
    }
    const blocked = await blockedDestination(built.url);
    if (blocked) return { blocked };
    const res = await this.http.request({
      method: built.method as RequestSpec['method'],
      url: built.url,
      headers: built.headers,
      rawBody: built.rawBody,
      timeoutMs: ctx.timeouts.queryMs,
    });
    return { built, res };
  }

  /** Chặn đăng nhập tới địa chỉ nội bộ khi gọi thử bằng bản đang sửa. */
  private async loginBlocked(
    ctx: SupplierContext,
    params: HttpConfigParams,
  ): Promise<string | null> {
    try {
      const built = buildRequest(
        params.spec,
        params.spec.token.request,
        ctx.baseUrl,
        requestScope(params, ctx.secrets, null),
        'login',
      );
      return await blockedDestination(built.url);
    } catch (error) {
      return error instanceof UnknownHostError
        ? error.message
        : 'Địa chỉ đăng nhập không hợp lệ';
    }
  }

  private exchange(
    built: BuiltRequest,
    res: HttpResult,
    secrets: Record<string, unknown>,
    token: string | null,
  ): LiveExchange {
    const masks = token ? { ...secrets, token } : secrets;
    const tooLong = res.ok && res.rawText.length > MAX_BODY_CHARS;
    return maskSecretValues(
      {
        request: {
          method: built.method,
          url: built.url,
          headers: built.headers,
          body: built.bodyForTrace ?? null,
        },
        response: res.ok
          ? {
              ok: true as const,
              httpStatus: res.status,
              durationMs: res.durationMs,
              headers: res.headers ?? {},
              body: tooLong ? res.rawText.slice(0, MAX_BODY_CHARS) : res.body,
              truncated: tooLong,
            }
          : {
              ok: false as const,
              error: res.kind,
              message: res.message,
              durationMs: res.durationMs,
            },
      },
      masks,
    );
  }
}
