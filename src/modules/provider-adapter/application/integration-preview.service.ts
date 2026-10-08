import { Injectable } from '@nestjs/common';
import {
  OrderDelivery,
  SupplierResult,
} from '@modules/provider-adapter/domain/supplier-result';
import type {
  SupplierOrderSummary,
  SupplierPackage,
} from '@modules/provider-adapter/domain/provider-adapter.port';
import type { OrderExtraField } from '@modules/provider-adapter/domain/order-fields';
import type { BalanceView } from '@modules/provider-adapter/application/integration-call.service';
import { HttpResult } from '@modules/provider-adapter/infrastructure/http/http-json.client';
import type { IntegrationSpec } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.types';
import {
  parseParams,
  readinessIssues,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.validation';
import {
  buildRequest,
  Classified,
  classifyOrdersLookup,
  classifyQuery,
  classifySubmit,
  classifyTest,
  OrderInput,
  readCallback,
  readCheck,
  readOrderItems,
  readPackages,
  readToken,
  requestScope,
  summarizeOrder,
  UnknownHostError,
  checkTarget,
  readBalance,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.engine';

export const PREVIEW_KINDS = [
  'LOGIN',
  'PACKAGES',
  'CHECK',
  'BALANCE',
  'SUBMIT',
  'QUERY',
  'ORDERS',
  'TEST',
  'CALLBACK',
] as const;
export type PreviewKind = (typeof PREVIEW_KINDS)[number];

export interface PreviewInput {
  baseUrl: string;
  params: Record<string, unknown>;
  kind: PreviewKind;
  order?: Record<string, unknown>;
  response?: {
    httpStatus?: number;
    body?: unknown;
    headers?: Record<string, string>;
  };
}

export interface PreviewResult {
  outcome: string;
  errorCode: string | null;
  errorMessage: string | null;
  supplierTransId: string | null;
  delivery: OrderDelivery | null;
  retryAfterSec: number | null;
}

export interface PreviewOutput {
  issues: string[];
  warnings: string[];
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: unknown;
    signature: string | null;
    signedPayload: string | null;
    signatureRule: string | null;
  } | null;
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

const SAMPLE_TRANS_CODE = '0192a7b3-c4d5-7e8f-9a0b-1c2d3e4f5a6b';

function text(value: unknown, fallback: string | null): string | null {
  return typeof value === 'string' ? value : fallback;
}

export function toPreviewResult(result: SupplierResult): PreviewResult {
  return {
    outcome: result.outcome,
    errorCode: result.error?.code ?? null,
    errorMessage: result.error?.message ?? null,
    supplierTransId: result.supplierTransId ?? null,
    delivery: result.delivery ?? null,
    retryAfterSec: result.retryAfterSec ?? null,
  };
}

/**
 * "Phân loại thử" cho giao diện: dựng request mẫu và chạy đúng engine với phản hồi mẫu,
 * không gọi nhà cung cấp. Bí mật được thay bằng ***tên***.
 */
const SAMPLE_EXTRA: Record<
  OrderExtraField['type'],
  (today: string) => unknown
> = {
  TEXT: () => 'gia_tri_mau',
  NUMBER: () => 1,
  DATE: (today) => today,
  TEXT_LIST: () => ['mau_1'],
};

/** Giá trị mẫu cho trường thêm: lấy từ đơn mẫu nếu có, không thì sinh theo kiểu. */
function sampleExtra(
  spec: IntegrationSpec,
  given: unknown,
): Record<string, unknown> {
  const provided =
    given && typeof given === 'object' && !Array.isArray(given)
      ? (given as Record<string, unknown>)
      : {};
  const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  return Object.fromEntries(
    spec.extraFields.map((field) => [
      field.key,
      provided[field.key] ??
        (field.options.length > 0 &&
        field.type !== 'NUMBER' &&
        field.type !== 'DATE'
          ? field.type === 'TEXT_LIST'
            ? [field.options[0]]
            : field.options[0]
          : SAMPLE_EXTRA[field.type](today)),
    ]),
  );
}

@Injectable()
export class IntegrationPreviewService {
  preview(input: PreviewInput): PreviewOutput {
    const { params, issues } = parseParams(input.params);
    const empty: PreviewOutput = {
      issues,
      warnings: [],
      request: null,
      result: null,
      explain: null,
    };
    if (issues.length > 0) return empty;

    const warnings = readinessIssues(params);
    const { spec } = params;
    const secrets = Object.fromEntries(
      params.secretKeys.map((key) => [key, `***${key}***`]),
    );
    const order: OrderInput = {
      transCode:
        text(input.order?.transCode, SAMPLE_TRANS_CODE) ?? SAMPLE_TRANS_CODE,
      action:
        text(input.order?.action, spec.actions[0] ?? 'BUY_DATA') ?? 'BUY_DATA',
      packageCode: text(input.order?.packageCode, 'MA_GOI') ?? 'MA_GOI',
      phone: text(input.order?.phone, '0912345678'),
      serial: text(input.order?.serial, null),
      supplierTransId: text(input.order?.supplierTransId, null),
      extra: sampleExtra(spec, input.order?.extra),
    };

    let request: PreviewOutput['request'] = null;
    if (input.kind !== 'CALLBACK') {
      const queryByOrders =
        input.kind === 'QUERY' && spec.query.source === 'ORDERS';
      const target = {
        LOGIN: spec.token.request,
        PACKAGES: spec.packages.request,
        CHECK: spec.check.request,
        BALANCE: spec.balance.request,
        SUBMIT: spec.submit.request,
        QUERY: queryByOrders ? spec.orders.request : spec.query.request,
        ORDERS: spec.orders.request,
        TEST: spec.test.request,
      }[input.kind];
      const callKind = queryByOrders
        ? 'orders'
        : (
            {
              LOGIN: 'login',
              PACKAGES: 'packages',
              CHECK: 'check',
              BALANCE: 'balance',
              SUBMIT: 'submit',
              QUERY: 'query',
              ORDERS: 'orders',
              TEST: 'test',
            } as const
          )[input.kind];
      const now = Date.now();
      try {
        const built = buildRequest(
          spec,
          target,
          input.baseUrl,
          requestScope(params, secrets, order, {
            token:
              spec.token.enabled && input.kind !== 'LOGIN'
                ? '***token***'
                : null,
            range: { from: new Date(now - 86_400_000), to: new Date(now) },
          }),
          callKind,
        );
        request = {
          method: built.method,
          url: built.url,
          headers: built.headers,
          body: built.bodyForTrace ?? null,
          signature: built.signature ?? null,
          signedPayload: built.signedPayload ?? null,
          signatureRule: built.signatureRule ?? null,
        };
      } catch (error) {
        return {
          ...empty,
          warnings,
          issues: [
            error instanceof UnknownHostError
              ? error.message
              : 'Địa chỉ API (Base URL) hoặc đường dẫn không hợp lệ',
          ],
        };
      }
    }

    if (!input.response)
      return { issues: [], warnings, request, result: null, explain: null };

    const rawBody = input.response.body;
    let body: unknown = rawBody;
    if (typeof rawBody === 'string') {
      try {
        body = JSON.parse(rawBody) as unknown;
      } catch {
        body = rawBody;
      }
    }
    const headers = Object.fromEntries(
      Object.entries(input.response.headers ?? {}).map(([key, value]) => [
        key.toLowerCase(),
        String(value),
      ]),
    );
    const res: HttpResult = {
      ok: true,
      status: input.response.httpStatus ?? 200,
      body,
      rawText:
        typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody ?? null),
      headers,
      durationMs: 0,
    };
    const trace = { durationMs: 0 };

    if (input.kind === 'LOGIN') {
      const reading = readToken(spec, res);
      return {
        issues: [],
        warnings,
        request,
        result: {
          outcome: reading.ok ? 'OK' : 'FAIL',
          errorCode: null,
          errorMessage: reading.ok ? null : reading.message,
          supplierTransId: null,
          delivery: null,
          retryAfterSec: null,
        },
        explain: reading.ok
          ? `Lấy được token ${reading.token.slice(0, 12)}…, Hub dùng lại trong ${Math.round(reading.ttlSec / 60)} phút rồi tự đăng nhập lại`
          : `Không lấy được token: ${reading.message}`,
      };
    }

    const plain = (outcome: string, errorMessage: string | null = null) => ({
      outcome,
      errorCode: null,
      errorMessage,
      supplierTransId: null,
      delivery: null,
      retryAfterSec: null,
    });
    if (input.kind === 'PACKAGES') {
      const reading = readPackages(spec, res);
      return {
        issues: [],
        warnings,
        request,
        result: plain(
          reading.ok ? 'OK' : 'FAIL',
          reading.ok ? null : reading.message,
        ),
        explain: reading.explain,
        packages: reading.packages,
      };
    }
    if (input.kind === 'CHECK') {
      const reading = readCheck(spec, res, checkTarget(params, order));
      return {
        issues: [],
        warnings,
        request,
        result: plain(
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
    if (input.kind === 'BALANCE') {
      const reading = readBalance(params, res, order);
      return {
        issues: [],
        warnings,
        request,
        result: plain(
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
    if (input.kind === 'ORDERS') {
      const reading = readOrderItems(spec, res);
      const orders = reading.items.map((item) => summarizeOrder(spec, item));
      return {
        issues: [],
        warnings,
        request,
        result: plain(
          reading.ok ? 'OK' : 'FAIL',
          reading.ok ? null : reading.message,
        ),
        explain: reading.ok ? `Đọc được ${orders.length} đơn` : reading.message,
        orders,
      };
    }

    let classified: Classified;
    if (input.kind === 'SUBMIT') {
      classified = classifySubmit(spec, res, trace);
    } else if (input.kind === 'QUERY') {
      classified =
        spec.query.source === 'ORDERS'
          ? classifyOrdersLookup(
              spec,
              res,
              order.transCode,
              trace,
              order.supplierTransId,
            )
          : classifyQuery(spec, res, order.transCode, trace);
    } else if (input.kind === 'TEST') {
      const tested = classifyTest(spec, res);
      return {
        issues: [],
        warnings,
        request,
        result: {
          outcome: tested.ok ? 'OK' : 'FAIL',
          errorCode: null,
          errorMessage: tested.ok ? null : tested.message,
          supplierTransId: null,
          delivery: null,
          retryAfterSec: null,
        },
        explain: tested.message,
      };
    } else {
      const reading = readCallback(spec, body, headers, trace);
      classified = {
        result: reading.classified.result,
        explain: `${reading.classified.explain}. Mã sự kiện: ${reading.eventId ?? '(không đọc được)'} · mã đơn: ${reading.transCode ?? '(không đọc được)'}`,
      };
    }
    return {
      issues: [],
      warnings,
      request,
      result: toPreviewResult(classified.result),
      explain: classified.explain,
    };
  }
}
