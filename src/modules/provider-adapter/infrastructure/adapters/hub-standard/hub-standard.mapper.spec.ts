import {
  classifyStdCreate,
  classifyStdQuery,
  readStdCheck,
  readStdOrders,
  readStdPackages,
} from '@modules/provider-adapter/infrastructure/adapters/hub-standard/hub-standard.mapper';
import { HttpResult } from '@modules/provider-adapter/infrastructure/http/http-json.client';
import {
  OutcomeType,
  SUPPLIER_CONFIG_ERROR,
} from '@modules/provider-adapter/domain/supplier-result';

const TX = 'TX1';
const trace = { durationMs: 1 };

function http(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): HttpResult {
  return {
    ok: true,
    status,
    body,
    rawText: JSON.stringify(body),
    headers,
    durationMs: 1,
  };
}

const order = (status: string, extra: Record<string, unknown> = {}) => ({
  code: 'OK',
  message: 'ok',
  data: { requestId: TX, orderId: 'NCC-1', status, ...extra },
});
const error = (code: string) => ({ code, message: code, data: null });
const timeout: HttpResult = {
  ok: false,
  kind: 'TIMEOUT',
  message: 'timeout',
  durationMs: 1,
};
const network: HttpResult = {
  ok: false,
  kind: 'NETWORK',
  message: 'ECONNREFUSED',
  durationMs: 1,
};

describe('Chuẩn Hub v1: tạo đơn', () => {
  it.each<[string, HttpResult, OutcomeType, string | null]>([
    ['200 PROCESSING', http(200, order('PROCESSING')), 'PENDING', null],
    ['200 SUCCESS', http(200, order('SUCCESS')), 'SUCCESS', null],
    [
      '200 FAILED có errorCode',
      http(200, order('FAILED', { errorCode: 'SUBSCRIBER_INVALID' })),
      'FAILED',
      'SUBSCRIBER_INVALID',
    ],
    [
      '200 FAILED thiếu errorCode',
      http(200, order('FAILED')),
      'FAILED',
      'REJECTED',
    ],
    [
      '200 trạng thái lạ',
      http(200, order('DONE')),
      'UNKNOWN',
      'STD_UNKNOWN_STATUS',
    ],
    [
      '200 requestId không khớp',
      http(200, { code: 'OK', data: { requestId: 'TX9', status: 'SUCCESS' } }),
      'UNKNOWN',
      'STD_REQUEST_ID_MISMATCH',
    ],
    [
      '400 INVALID_REQUEST',
      http(400, error('INVALID_REQUEST')),
      'FAILED',
      'INVALID_REQUEST',
    ],
    ['400 không theo chuẩn', http(400, '<html>'), 'UNKNOWN', 'STD_400'],
    ['401', http(401, error('UNAUTHORIZED')), 'FAILED', SUPPLIER_CONFIG_ERROR],
    ['403 không body', http(403, null), 'FAILED', SUPPLIER_CONFIG_ERROR],
    [
      '409',
      http(409, error('REQUEST_ID_CONFLICT')),
      'UNKNOWN',
      'STD_REQUEST_ID_CONFLICT',
    ],
    ['429', http(429, error('RATE_LIMITED')), 'UNKNOWN', 'STD_RATE_LIMITED'],
    [
      '500',
      http(500, error('INTERNAL_ERROR')),
      'UNKNOWN',
      'STD_INTERNAL_ERROR',
    ],
    ['503 không body', http(503, null), 'UNKNOWN', 'STD_503'],
    [
      '404 khi tạo đơn',
      http(404, error('ORDER_NOT_FOUND')),
      'UNKNOWN',
      'STD_ORDER_NOT_FOUND',
    ],
    ['timeout', timeout, 'UNKNOWN', 'SUPPLIER_TIMEOUT'],
    ['lỗi mạng', network, 'UNKNOWN', 'SUPPLIER_UNREACHABLE'],
  ])('%s', (_name, res, outcome, code) => {
    const result = classifyStdCreate(res, TX, trace);
    expect(result.outcome).toBe(outcome);
    if (code) expect(result.error?.code).toBe(code);
  });

  it('đọc orderId và delivery', () => {
    const result = classifyStdCreate(
      http(
        200,
        order('SUCCESS', {
          delivery: { msisdn: '0900000001', lpa: 'LPA:1$x$y', qrUrl: 7 },
        }),
      ),
      TX,
      trace,
    );
    expect(result.supplierTransId).toBe('NCC-1');
    expect(result.delivery).toEqual({ msisdn: '0900000001', lpa: 'LPA:1$x$y' });
  });

  it('429 có Retry-After thì gợi ý thời điểm thử lại', () => {
    const result = classifyStdCreate(
      http(429, error('RATE_LIMITED'), { 'retry-after': '30' }),
      TX,
      trace,
    );
    expect(result.retryAfterSec).toBe(30);
  });
});

describe('Chuẩn Hub v1: tra cứu', () => {
  it.each<[string, HttpResult, OutcomeType]>([
    ['200 SUCCESS', http(200, order('SUCCESS')), 'SUCCESS'],
    [
      '200 FAILED',
      http(200, order('FAILED', { errorCode: 'OUT_OF_STOCK' })),
      'FAILED',
    ],
    ['404 ORDER_NOT_FOUND', http(404, error('ORDER_NOT_FOUND')), 'NOT_FOUND'],
    ['404 không theo chuẩn', http(404, '<html>'), 'UNKNOWN'],
    ['400', http(400, error('INVALID_REQUEST')), 'UNKNOWN'],
    ['401', http(401, error('UNAUTHORIZED')), 'UNKNOWN'],
    ['500', http(500, error('INTERNAL_ERROR')), 'UNKNOWN'],
    ['timeout', timeout, 'UNKNOWN'],
  ])('%s', (_name, res, outcome) => {
    expect(classifyStdQuery(res, TX, trace).outcome).toBe(outcome);
  });
});

describe('API không bắt buộc của quy chuẩn v1', () => {
  const okRes = (status: number, body: unknown): HttpResult => ({
    ok: true,
    status,
    body,
    rawText: JSON.stringify(body),
    headers: {},
    durationMs: 1,
  });
  const trace = { durationMs: 1 };

  it('danh sách gói: đọc packageCode/name/price, bỏ phần tử thiếu mã', () => {
    expect(
      readStdPackages(
        okRes(200, {
          code: 'OK',
          data: {
            items: [
              { packageCode: 'DATA5GB', name: 'Data 5GB', price: 50000 },
              { name: 'thiếu mã' },
            ],
          },
        }),
        trace,
      ),
    ).toEqual({
      ok: true,
      packages: [
        { code: 'DATA5GB', name: 'Data 5GB', price: 50000, description: null },
      ],
      trace,
    });
  });

  it('404 NOT_SUPPORTED: NCC không có API này', () => {
    const res = okRes(404, { code: 'NOT_SUPPORTED', message: 'x' });
    expect(readStdPackages(res, trace)).toMatchObject({
      ok: false,
      unsupported: true,
    });
    expect(readStdCheck(res, trace)).toMatchObject({
      eligible: null,
      unsupported: true,
    });
    expect(readStdOrders(res, trace)).toMatchObject({
      ok: false,
      unsupported: true,
    });
  });

  it.each([
    [{ eligible: true }, true, null],
    [
      { eligible: false, reasonCode: 'NO_QUOTA', reasonMessage: 'Hết lượt' },
      false,
      { code: 'NO_QUOTA', message: 'Hết lượt' },
    ],
    [{}, null, null],
  ])('kiểm tra gói %j → %s', (data, eligible, reason) => {
    expect(readStdCheck(okRes(200, { code: 'OK', data }), trace)).toMatchObject(
      { eligible, reason },
    );
  });

  it('danh sách đơn: đọc theo trạng thái quy chuẩn', () => {
    expect(
      readStdOrders(
        okRes(200, {
          code: 'OK',
          data: {
            items: [
              {
                requestId: 'TX1',
                orderId: 'N1',
                status: 'SUCCESS',
                createdAt: '2026-10-01T00:00:00Z',
              },
            ],
          },
        }),
        trace,
      ),
    ).toMatchObject({
      ok: true,
      orders: [
        {
          transCode: 'TX1',
          supplierTransId: 'N1',
          status: 'SUCCESS',
          outcome: 'SUCCESS',
          createdAt: '2026-10-01T00:00:00Z',
        },
      ],
    });
  });
});
