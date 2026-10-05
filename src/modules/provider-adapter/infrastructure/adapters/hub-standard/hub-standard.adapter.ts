import { Injectable } from '@nestjs/common';
import { OrderAction } from '@modules/provider-adapter/domain/order-action';
import {
  AdapterFeatures,
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
import { SupplierResult } from '@modules/provider-adapter/domain/supplier-result';
import { InvalidCallbackPayloadError } from '@modules/provider-adapter/domain/adapter.errors';
import {
  HttpJsonClient,
  HttpResult,
} from '@modules/provider-adapter/infrastructure/http/http-json.client';
import {
  asText,
  headerValue,
  traceOf,
} from '@modules/provider-adapter/infrastructure/http/trace';
import { maskSensitive } from '@common/libs/mask-sensitive';
import {
  HubStandardParams,
  HubStandardSecrets,
} from '@modules/provider-adapter/infrastructure/adapters/hub-standard/hub-standard.config';
import {
  classifyStdCreate,
  classifyStdQuery,
  mapStdOrder,
  readStdCheck,
  readStdOrders,
  readStdPackages,
  StdOrder,
} from '@modules/provider-adapter/infrastructure/adapters/hub-standard/hub-standard.mapper';
import {
  isFreshTimestamp,
  safeEqual,
  signCallback,
  signedPathOf,
  signRequest,
} from '@modules/provider-adapter/infrastructure/adapters/hub-standard/hub-standard.signature';

const CLOCK_WARNING_SEC = 120;

interface StdCallbackBody {
  eventId?: unknown;
  order?: unknown;
}

/** NCC làm theo Quy chuẩn API nhà cung cấp v1: chỉ cần URL, keyId, secret. */
@Injectable()
export class HubStandardAdapter implements ProviderAdapter {
  readonly type = 'HUB_STANDARD';
  readonly meta = {
    label: 'Chuẩn Hub v1',
    description:
      'Nhà cung cấp làm theo Quy chuẩn API nhà cung cấp v1. Chỉ cần nhập URL và khoá, không phải map.',
    editor: 'FIELDS' as const,
    params: [
      {
        key: 'keyId',
        label: 'Key ID',
        required: true,
        help: 'NCC cấp, gửi trong header X-Hub-Key-Id',
        placeholder: 'hub-sandbox',
      },
      {
        key: 'checkBeforeSubmit',
        label: 'Kiểm tra gói trước khi gửi đơn',
        required: false,
        type: 'boolean' as const,
        help: 'Gọi POST /packages/check trước lần gửi đầu; NCC báo không đăng ký được thì đơn thất bại ngay, không gửi',
      },
    ],
    secrets: [
      {
        key: 'secret',
        label: 'Secret ký request',
        required: true,
        help: 'NCC cấp, dùng để ký mọi request Hub gửi sang NCC',
      },
      {
        key: 'callbackSecret',
        label: 'Secret kiểm callback',
        required: false,
        help: 'Hub cấp cho NCC để ký callback. Bỏ trống thì mọi callback bị từ chối, Hub chỉ tra cứu định kỳ',
      },
    ],
  };
  readonly capabilities = {
    actions: [
      OrderAction.BUY_DATA,
      OrderAction.TOPUP,
      OrderAction.ACTIVATE_SIM,
    ],
    callback: true,
  };
  readonly paramsClass = HubStandardParams;
  readonly secretsClass = HubStandardSecrets;

  constructor(private readonly http: HttpJsonClient) {}

  /** API danh sách gói / kiểm tra gói / danh sách đơn là không bắt buộc: NCC không có thì trả 404 NOT_SUPPORTED. */
  features(ctx: SupplierContext): AdapterFeatures {
    const flag = ctx.params.checkBeforeSubmit;
    return {
      packages: true,
      check: true,
      checkBeforeSubmit: flag === true || flag === 'true',
      orderList: true,
    };
  }

  async listPackages(
    ctx: SupplierContext,
    filter: PackageFilter,
  ): Promise<PackageListResult> {
    const query = new URLSearchParams();
    if (filter.action) query.set('action', filter.action);
    if (filter.phone) query.set('msisdn', filter.phone);
    if (filter.serial) query.set('serial', filter.serial);
    const search = query.toString();
    const res = await this.send(
      ctx,
      'GET',
      `/packages${search ? `?${search}` : ''}`,
      ctx.timeouts.queryMs,
    );
    return readStdPackages(res, traceOf({ filter }, res));
  }

  async checkPackage(
    ctx: SupplierContext,
    cmd: PackageCheckCommand,
  ): Promise<PackageCheckResult> {
    const body = {
      action: cmd.action,
      packageCode: cmd.packageCode,
      msisdn: cmd.phone,
      serial: cmd.serial,
    };
    const res = await this.send(
      ctx,
      'POST',
      '/packages/check',
      ctx.timeouts.queryMs,
      body,
    );
    return readStdCheck(res, traceOf(body, res));
  }

  async listOrders(
    ctx: SupplierContext,
    range: OrderRange,
  ): Promise<OrderListResult> {
    const query = new URLSearchParams({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    });
    const res = await this.send(
      ctx,
      'GET',
      `/orders?${query.toString()}`,
      ctx.timeouts.queryMs,
    );
    return readStdOrders(res, traceOf({ range }, res));
  }

  async submit(
    ctx: SupplierContext,
    cmd: OrderCommand,
  ): Promise<SupplierResult> {
    const body = {
      requestId: cmd.transCode,
      action: cmd.action,
      packageCode: cmd.packageCode,
      msisdn: cmd.phone,
      serial: cmd.serial,
    };
    const res = await this.send(
      ctx,
      'POST',
      '/orders',
      ctx.timeouts.submitMs,
      body,
    );
    return classifyStdCreate(res, cmd.transCode, traceOf(body, res));
  }

  async query(ctx: SupplierContext, ref: OrderRef): Promise<SupplierResult> {
    const path = `/orders/${encodeURIComponent(ref.transCode)}`;
    const res = await this.send(ctx, 'GET', path, ctx.timeouts.queryMs);
    return classifyStdQuery(
      res,
      ref.transCode,
      traceOf({ requestId: ref.transCode }, res),
    );
  }

  async testConnection(ctx: SupplierContext): Promise<ConnectionTestResult> {
    const res = await this.send(ctx, 'GET', '/ping', ctx.timeouts.queryMs);
    if (!res.ok) {
      return { ok: false, latencyMs: res.durationMs, message: res.message };
    }
    const env = (res.body ?? {}) as {
      code?: unknown;
      message?: unknown;
      data?: { serverTime?: unknown } | null;
    };
    if (res.status >= 300 || env.code !== 'OK') {
      return {
        ok: false,
        latencyMs: res.durationMs,
        message:
          `HTTP ${res.status} ${asText(env.code)}: ${asText(env.message)}`.trim(),
      };
    }
    return {
      ok: true,
      latencyMs: res.durationMs,
      message: describeClock(env.data?.serverTime),
    };
  }

  verifyCallback(ctx: SupplierContext, raw: RawCallback): Promise<boolean> {
    const secret = asText(ctx.secrets.callbackSecret);
    const timestamp = headerValue(raw.headers, 'x-supplier-timestamp');
    const signature = headerValue(raw.headers, 'x-supplier-signature');
    if (!secret || !timestamp || !signature || raw.rawBody === undefined) {
      return Promise.resolve(false);
    }
    if (!isFreshTimestamp(timestamp)) return Promise.resolve(false);
    return Promise.resolve(
      safeEqual(signature, signCallback(secret, timestamp, raw.rawBody)),
    );
  }

  parseCallback(
    _ctx: SupplierContext,
    raw: RawCallback,
  ): Promise<ParsedCallback> {
    const body = raw.body as StdCallbackBody | null;
    if (
      !body ||
      typeof body.eventId !== 'string' ||
      body.eventId.length === 0 ||
      !body.order ||
      typeof body.order !== 'object'
    ) {
      throw new InvalidCallbackPayloadError(
        'Callback phải có eventId và order',
      );
    }
    const order = body.order as StdOrder;
    return Promise.resolve({
      eventId: body.eventId,
      transCode:
        typeof order.requestId === 'string' ? order.requestId : undefined,
      supplierTransId:
        typeof order.orderId === 'string' ? order.orderId : undefined,
      result: mapStdOrder(order, {
        response: maskSensitive(body),
        durationMs: 0,
      }),
    });
  }

  private send(
    ctx: SupplierContext,
    method: 'GET' | 'POST',
    path: string,
    timeoutMs: number,
    body?: unknown,
  ): Promise<HttpResult> {
    const url = `${ctx.baseUrl}${path}`;
    const rawBody = body === undefined ? '' : JSON.stringify(body);
    const timestamp = String(Math.floor(Date.now() / 1000));
    return this.http.request({
      method,
      url,
      headers: {
        'X-Hub-Key-Id': asText(ctx.params.keyId),
        'X-Hub-Timestamp': timestamp,
        'X-Hub-Signature': signRequest(
          asText(ctx.secrets.secret),
          timestamp,
          method,
          signedPathOf(url),
          rawBody,
        ),
      },
      rawBody: body === undefined ? undefined : rawBody,
      timeoutMs,
    });
  }
}

function describeClock(serverTime: unknown): string {
  const parsed = typeof serverTime === 'string' ? Date.parse(serverTime) : NaN;
  if (!Number.isFinite(parsed)) return 'Kết nối và chữ ký hợp lệ';
  const skewSec = Math.round((parsed - Date.now()) / 1000);
  const warning =
    Math.abs(skewSec) > CLOCK_WARNING_SEC
      ? ', cần chỉnh lại giờ trước khi chữ ký bị từ chối'
      : '';
  return `Kết nối và chữ ký hợp lệ, giờ NCC lệch ${skewSec} giây${warning}`;
}
