import { Injectable } from '@nestjs/common';
import { OrderAction } from '@modules/provider-adapter/domain/order-action';
import {
  ConnectionTestResult,
  OrderCommand,
  OrderRef,
  ParsedCallback,
  ProviderAdapter,
  RawCallback,
  SupplierContext,
} from '@modules/provider-adapter/domain/provider-adapter.port';
import { SupplierResult } from '@modules/provider-adapter/domain/supplier-result';
import { InvalidCallbackPayloadError } from '@modules/provider-adapter/domain/adapter.errors';
import { HttpJsonClient } from '@modules/provider-adapter/infrastructure/http/http-json.client';
import {
  asText,
  headerValue,
  traceOf,
} from '@modules/provider-adapter/infrastructure/http/trace';
import { maskSensitive } from '@common/libs/mask-sensitive';
import {
  AnisimParams,
  AnisimSecrets,
} from '@modules/provider-adapter/infrastructure/adapters/anisim/anisim.config';
import {
  AnisimOrder,
  classifyAnisimCreate,
  classifyAnisimQuery,
  mapAnisimOrder,
} from '@modules/provider-adapter/infrastructure/adapters/anisim/anisim.mapper';

const ORDER_RESULT_EVENT = 'ORDER_RESULT';

interface AnisimCallbackBody {
  event?: string;
  eventId?: string;
  requestId?: string;
  data?: AnisimOrder;
}

/** ANI SIM Agency API v3.0 (ani_agency.pdf). */
@Injectable()
export class AnisimAdapter implements ProviderAdapter {
  readonly type = 'ANISIM';
  readonly capabilities = {
    actions: [OrderAction.ACTIVATE_SIM],
    callback: true,
  };
  readonly paramsClass = AnisimParams;
  readonly secretsClass = AnisimSecrets;

  constructor(private readonly http: HttpJsonClient) {}

  async submit(
    ctx: SupplierContext,
    cmd: OrderCommand,
  ): Promise<SupplierResult> {
    const body = {
      requestId: cmd.transCode,
      packagePlanId: cmd.packageCode,
      ...(cmd.serial ? { serial: cmd.serial } : {}),
    };
    const res = await this.http.request({
      method: 'POST',
      url: `${ctx.baseUrl}/api/v1/agency/orders`,
      headers: this.authHeaders(ctx),
      body,
      timeoutMs: ctx.timeouts.submitMs,
    });
    return classifyAnisimCreate(res, traceOf(body, res));
  }

  async query(ctx: SupplierContext, ref: OrderRef): Promise<SupplierResult> {
    const params = new URLSearchParams({
      keyword: ref.transCode,
      page: '0',
      limit: '20',
    });
    const res = await this.http.request({
      method: 'GET',
      url: `${ctx.baseUrl}/api/v1/agency/orders?${params.toString()}`,
      headers: this.authHeaders(ctx),
      timeoutMs: ctx.timeouts.queryMs,
    });
    return classifyAnisimQuery(
      res,
      ref.transCode,
      traceOf({ keyword: ref.transCode }, res),
    );
  }

  parseCallback(
    _ctx: SupplierContext,
    raw: RawCallback,
  ): Promise<ParsedCallback> {
    const body = raw.body as AnisimCallbackBody | null;
    if (!body || typeof body !== 'object' || !body.data) {
      throw new InvalidCallbackPayloadError('Callback ANI SIM thiếu data');
    }

    const event = body.event ?? headerValue(raw.headers, 'x-mk-callback-event');
    if (event && event !== ORDER_RESULT_EVENT) {
      throw new InvalidCallbackPayloadError(
        `Sự kiện callback không hỗ trợ: ${event}`,
      );
    }

    const eventId =
      body.eventId ?? headerValue(raw.headers, 'x-mk-callback-id');
    if (!eventId) {
      throw new InvalidCallbackPayloadError('Callback ANI SIM thiếu eventId');
    }

    return Promise.resolve({
      eventId,
      transCode: body.data.requestId ?? body.requestId,
      supplierTransId: body.data.id,
      result: mapAnisimOrder(body.data, {
        response: maskSensitive(body),
        durationMs: 0,
      }),
    });
  }

  async testConnection(ctx: SupplierContext): Promise<ConnectionTestResult> {
    const res = await this.http.request({
      method: 'GET',
      url: `${ctx.baseUrl}/api/v1/agency/package-plans?page=0&limit=1`,
      headers: this.authHeaders(ctx),
      timeoutMs: ctx.timeouts.queryMs,
    });
    if (!res.ok) {
      return { ok: false, latencyMs: res.durationMs, message: res.message };
    }
    const env = (res.body ?? {}) as { code?: number; message?: string };
    return {
      ok: res.status < 300 && env.code === 0,
      latencyMs: res.durationMs,
      message: env.message ?? `HTTP ${res.status}`,
    };
  }

  private authHeaders(ctx: SupplierContext): Record<string, string> {
    return { 'X-API-Key': asText(ctx.secrets.apiKey) };
  }
}
