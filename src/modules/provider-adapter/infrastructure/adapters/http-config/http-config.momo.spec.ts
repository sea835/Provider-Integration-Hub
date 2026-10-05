import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HttpResult } from '@modules/provider-adapter/infrastructure/http/http-json.client';
import { SUPPLIER_CONFIG_ERROR } from '@modules/provider-adapter/domain/supplier-result';
import {
  buildRequest,
  classifyQuery,
  classifySubmit,
  needsTokenRefresh,
  OrderInput,
  readToken,
  requestScope,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.engine';
import {
  parseParams,
  readinessIssues,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.validation';

/** Bản tích hợp MoMo TELCO B2B (`tools/integrations/momo.json`): đăng nhập lấy token, ký body, requestId UUID. */
const raw = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../../../tools/integrations/momo.json'),
    'utf8',
  ),
) as Record<string, unknown>;
const { params, issues } = parseParams(raw);
const spec = params.spec;
const secrets = { password: 'pw_demo_1234', secretKey: 'momo_secret_key_123' };
const trace = { durationMs: 1 };
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const order: OrderInput = {
  transCode: 'PQ260930ABC',
  action: 'BUY_DATA',
  packageCode: '1N_TMDT',
  phone: '0912345678',
  serial: null,
  supplierTransId: null,
};

function http(status: number, body: unknown): HttpResult {
  return {
    ok: true,
    status,
    body,
    rawText: JSON.stringify(body),
    headers: {},
    durationMs: 1,
  };
}

function scope(token: string | null = 'tok-1', input = order) {
  return requestScope(params, secrets, input, { token });
}

describe('Bản tích hợp MoMo trên engine Tự cấu hình', () => {
  it('hợp lệ và đủ để chạy', () => {
    expect(issues).toEqual([]);
    expect(readinessIssues(params)).toEqual([]);
  });

  describe('dựng request', () => {
    it('gửi đơn: header chung, Bearer token, body ký HMAC-SHA256 trên body chưa có chữ ký', () => {
      const built = buildRequest(
        spec,
        spec.submit.request,
        'https://uat.momo.test',
        scope(),
        'submit',
      );
      expect(built.url).toBe('https://uat.momo.test/telco/v1/orders/create');
      expect(built.headers).toMatchObject({
        partnerCode: 'PHUONGQUAN',
        Authorization: 'Bearer tok-1',
        token: 'tok-1',
        env: 'uat',
      });
      expect(built.headers.requestId).toMatch(UUID);
      expect(built.headers.time).toMatch(/^\d{13}$/);

      const unsigned =
        '{"partnerTransId":"PQ260930ABC","phone":"0912345678","productId":"1N_TMDT"}';
      const expected = createHmac('sha256', 'momo_secret_key_123')
        .update(unsigned)
        .digest('hex');
      expect(built.signature).toBe(expected);
      expect(built.rawBody).toBe(
        `${unsigned.slice(0, -1)},"signature":"${expected}"}`,
      );
    });

    it('requestId mới cho mỗi lời gọi', () => {
      const ids = new Set(
        [1, 2, 3].map(
          () =>
            buildRequest(
              spec,
              spec.query.request,
              'https://m',
              scope(),
              'query',
            ).headers.requestId,
        ),
      );
      expect(ids.size).toBe(3);
    });

    it('tra cứu: không ký, momoTransId chỉ gửi khi đã có', () => {
      const first = buildRequest(
        spec,
        spec.query.request,
        'https://m',
        scope(),
        'query',
      );
      expect(first.url).toBe(
        'https://m/telco/v1/orders/status?partnerTransId=PQ260930ABC',
      );
      expect(first.signature).toBeUndefined();
      const later = buildRequest(
        spec,
        spec.query.request,
        'https://m',
        scope('tok-1', { ...order, supplierTransId: 'O2026' }),
        'query',
      );
      expect(later.url).toContain('&momoTransId=O2026');
    });

    it('đăng nhập: chưa có token thì không gửi Authorization / token, body là username + password', () => {
      const built = buildRequest(
        spec,
        spec.token.request,
        'https://m',
        scope(null),
        'login',
      );
      expect(built.url).toBe('https://m/telco/partner/login');
      expect(built.headers.Authorization).toBeUndefined();
      expect(built.headers.token).toBeUndefined();
      expect(built.headers.requestId).toMatch(UUID);
      expect(JSON.parse(built.rawBody!)).toEqual({
        username: 'pq_partner',
        password: 'pw_demo_1234',
      });
    });
  });

  describe('token', () => {
    it('đọc accessToken, hạn mặc định 6 ngày', () => {
      expect(
        readToken(
          spec,
          http(200, { error: 866000000, message: 'Success', accessToken: 'T' }),
        ),
      ).toEqual({ ok: true, token: 'T', ttlSec: 518400 });
    });

    it('sai tài khoản là REJECTED; 5xx / mất kết nối là TRANSPORT', () => {
      expect(
        readToken(
          spec,
          http(200, {
            error: 866300001,
            message: 'Unauthorized',
            accessToken: null,
          }),
        ),
      ).toMatchObject({ ok: false, reason: 'REJECTED' });
      expect(readToken(spec, http(503, {}))).toMatchObject({
        ok: false,
        reason: 'TRANSPORT',
      });
      expect(
        readToken(spec, {
          ok: false,
          kind: 'TIMEOUT',
          message: 'timeout',
          durationMs: 1,
        }),
      ).toMatchObject({ ok: false, reason: 'TRANSPORT' });
    });

    it.each([
      [401, {}, true],
      [200, { error: 866300020 }, true],
      [200, { error: 866300002 }, true],
      [200, { error: 862000000 }, false],
      [200, { error: 866300022 }, false],
    ])('HTTP %s %j → lấy token mới: %s', (status, body, expected) => {
      expect(needsTokenRefresh(spec, http(status, body))).toBe(expected);
    });
  });

  describe('phân loại gửi đơn', () => {
    const data = {
      momoTransId: '202608040001',
      partnerTransId: 'PQ260930ABC',
      phone: '0912345678',
      productId: '1N_TMDT',
      amount: 85000,
    };

    it.each([862000000, 862000009, 862600001])(
      'mã %s có data → đang xử lý, lưu momoTransId',
      (error) => {
        const { result } = classifySubmit(
          spec,
          http(200, { error, message: 'x', data }),
          trace,
        );
        expect(result).toMatchObject({
          outcome: 'PENDING',
          supplierTransId: '202608040001',
          delivery: { msisdn: '0912345678' },
        });
      },
    );

    it.each([862500001, 862500005, 862200001, 862100001])(
      'mã %s → thất bại MOMO_<mã>',
      (error) => {
        const { result } = classifySubmit(
          spec,
          http(200, { error, message: 'Rejected', data: null }),
          trace,
        );
        expect(result).toMatchObject({
          outcome: 'FAILED',
          error: { code: `MOMO_${error}` },
        });
      },
    );

    it.each([866300022, 866300004, 862800004])(
      'mã %s → sai cấu hình',
      (error) => {
        const { result } = classifySubmit(
          spec,
          http(200, { error, message: 'x', data: null }),
          trace,
        );
        expect(result).toMatchObject({
          outcome: 'FAILED',
          error: { code: SUPPLIER_CONFIG_ERROR },
        });
      },
    );

    it.each([
      [200, { error: 862400006, data: null }, 'MOMO_862400006'],
      [200, { error: 862000009, data: null }, 'MOMO_862000009'],
      [200, { error: 862999999, data: null }, 'HTTP_200'],
      [502, 'Bad gateway', 'HTTP_502'],
    ])('HTTP %s %j → chưa biết (%s)', (status, body, errorCode) => {
      const { result } = classifySubmit(spec, http(status, body), trace);
      expect(result).toMatchObject({
        outcome: 'UNKNOWN',
        error: { code: errorCode },
      });
    });
  });

  describe('phân loại tra cứu', () => {
    const status = (value: string, partnerTransId = 'PQ260930ABC') =>
      http(200, {
        error: 862000000,
        message: 'Success',
        data: {
          momoTransId: 'O2026',
          partnerTransId,
          phoneNumber: '0912345678',
          status: value,
        },
      });

    it.each([
      ['SUCCESS', 'SUCCESS'],
      ['FAILED', 'FAILED'],
      ['PENDING', 'PENDING'],
      ['Pending', 'PENDING'],
      ['REFUNDED', 'UNKNOWN'],
    ])('status %s → %s', (value, outcome) => {
      expect(
        classifyQuery(spec, status(value), 'PQ260930ABC', trace).result.outcome,
      ).toBe(outcome);
    });

    it('thất bại không có mã lỗi riêng → MOMO_ORDER_FAILED', () => {
      expect(
        classifyQuery(spec, status('FAILED'), 'PQ260930ABC', trace).result
          .error,
      ).toMatchObject({ code: 'MOMO_ORDER_FAILED' });
    });

    it('mã 862200003 → không có đơn', () => {
      const res = http(200, { error: 862200003, data: null });
      expect(
        classifyQuery(spec, res, 'PQ260930ABC', trace).result.outcome,
      ).toBe('NOT_FOUND');
    });

    it('đơn trả về khác mã của Hub → chưa biết', () => {
      expect(
        classifyQuery(spec, status('SUCCESS', 'OTHER'), 'PQ260930ABC', trace)
          .result,
      ).toMatchObject({
        outcome: 'UNKNOWN',
        error: { code: 'REQUEST_ID_MISMATCH' },
      });
    });

    it('lỗi khác khi tra cứu không bao giờ là thất bại', () => {
      const res = http(200, { error: 862200007, data: null });
      expect(
        classifyQuery(spec, res, 'PQ260930ABC', trace).result.outcome,
      ).toBe('UNKNOWN');
    });
  });
});
