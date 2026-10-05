import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HttpResult } from '@modules/provider-adapter/infrastructure/http/http-json.client';
import {
  OutcomeType,
  SUPPLIER_CONFIG_ERROR,
} from '@modules/provider-adapter/domain/supplier-result';
import {
  buildRequest,
  classifyOrdersLookup,
  readPackages,
  classifySubmit,
  maskSecretValues,
  readCallback,
  requestScope,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.engine';
import {
  parseParams,
  readinessIssues,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.validation';

/**
 * Các ca của adapter ANI SIM viết bằng code trước đây, nay chạy qua engine với
 * bản tích hợp `tools/integrations/anisim.json` (đúng thứ người dùng nhập trên giao diện).
 */
const raw = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../../../tools/integrations/anisim.json'),
    'utf8',
  ),
) as Record<string, unknown>;
const { params, issues } = parseParams(raw);
const spec = params.spec;
const trace = { durationMs: 1 };

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

const order = (overrides: Record<string, unknown> = {}) => ({
  id: 'ani-1',
  requestId: 'TX1',
  status: 1,
  qrStatus: 1,
  msisdn: '1211856324',
  serial: '8984012601500769003',
  lpa: 'LPA:1$x$y',
  urlLpa: 'https://qr',
  ...overrides,
});

describe('Bản tích hợp ANI SIM trên engine Tự cấu hình', () => {
  it('hợp lệ và đủ để chạy', () => {
    expect(issues).toEqual([]);
    expect(readinessIssues(params)).toEqual([]);
  });

  describe('trạng thái đơn (đọc khi tra cứu danh sách đơn)', () => {
    const listed = (data: Record<string, unknown>) =>
      classifyOrdersLookup(
        spec,
        http(200, { code: 0, data: { items: [order(data)] } }),
        'TX1',
        trace,
      ).result;

    it('tạo đơn: ANI luôn trả đang xử lý nên Hub chỉ ghi nhận đã nhận đơn và mã ANI', () => {
      const result = classifySubmit(
        spec,
        http(201, { code: 0, data: order({ status: 4 }) }),
        trace,
      ).result;
      expect(result).toMatchObject({
        outcome: 'PENDING',
        supplierTransId: 'ani-1',
      });
    });

    it.each([
      [1, 'PENDING'],
      [2, 'PENDING'],
      [3, 'PENDING'],
      [4, 'SUCCESS'],
      [5, 'FAILED'],
      [6, 'FAILED'],
      [99, 'UNKNOWN'],
    ])('status %s → %s', (status, outcome) => {
      expect(listed({ status }).outcome).toBe(outcome);
    });

    it('mã lỗi: ANI_{errorCode}, huỷ là ANI_ORDER_CANCELLED, thiếu mã là ANI_ORDER_FAILED', () => {
      const failed = (data: Record<string, unknown>) => listed(data).error;
      expect(
        failed({ status: 5, errorCode: '4012', errorMessage: 'Hết SIM' }),
      ).toMatchObject({
        code: 'ANI_4012',
        message: 'Hết SIM',
      });
      expect(failed({ status: 6 })?.code).toBe('ANI_ORDER_CANCELLED');
      expect(failed({ status: 5 })?.code).toBe('ANI_ORDER_FAILED');
    });

    it('đọc mã đơn NCC và thông tin giao hàng', () => {
      const result = listed({ status: 4 });
      expect(result.supplierTransId).toBe('ani-1');
      expect(result.delivery).toEqual({
        msisdn: '1211856324',
        serial: '8984012601500769003',
        lpa: 'LPA:1$x$y',
        qrUrl: 'https://qr',
      });
    });
  });

  describe('tạo đơn', () => {
    it.each<[string, HttpResult, OutcomeType, string | null]>([
      [
        '201 code 0 status 1',
        http(201, { code: 0, data: order() }),
        'PENDING',
        null,
      ],
      [
        '409 / 4002',
        http(409, { code: 4002, message: 'dup' }),
        'UNKNOWN',
        'ANI_4002',
      ],
      ['429 / 1000', http(429, { code: 1000 }), 'UNKNOWN', 'ANI_RATE_LIMIT'],
      [
        '401 / 2002',
        http(401, { code: 2002 }),
        'FAILED',
        SUPPLIER_CONFIG_ERROR,
      ],
      [
        '403 / 2001',
        http(403, { code: 2001 }),
        'FAILED',
        SUPPLIER_CONFIG_ERROR,
      ],
      [
        '400 / 4001',
        http(400, { code: 4001, message: 'Serial is not available' }),
        'FAILED',
        'ANI_4001',
      ],
      ['404 / 4000', http(404, { code: 4000 }), 'FAILED', 'ANI_4000'],
      ['502 / 6000', http(502, { code: 6000 }), 'FAILED', 'ANI_6000'],
      ['400 không body', http(400, null), 'FAILED', 'ANI_400'],
      ['500 / 5000', http(500, { code: 5000 }), 'UNKNOWN', null],
      ['502 không có body', http(502, null), 'UNKNOWN', null],
      [
        'timeout',
        { ok: false, kind: 'TIMEOUT', message: 't', durationMs: 1 },
        'UNKNOWN',
        'SUPPLIER_TIMEOUT',
      ],
      [
        'lỗi mạng',
        { ok: false, kind: 'NETWORK', message: 'n', durationMs: 1 },
        'UNKNOWN',
        'SUPPLIER_UNREACHABLE',
      ],
    ])('%s → %s', (_name, res, outcome, code) => {
      const result = classifySubmit(spec, res, trace).result;
      expect(result.outcome).toBe(outcome);
      if (code) expect(result.error?.code).toBe(code);
    });

    it('mã từ chối lấy thông báo của NCC', () => {
      const result = classifySubmit(
        spec,
        http(400, { code: 4001, message: 'Serial is not available' }),
        trace,
      ).result;
      expect(result.error?.message).toBe('Serial is not available');
    });
  });

  describe('tra cứu', () => {
    it('so khớp chính xác requestId (keyword tìm gần đúng)', () => {
      const res = http(200, {
        code: 0,
        data: {
          items: [
            order({ requestId: 'TX10', status: 4 }),
            order({ requestId: 'TX1', status: 5 }),
          ],
        },
      });
      expect(classifyOrdersLookup(spec, res, 'TX1', trace).result.outcome).toBe(
        'FAILED',
      );
    });

    it('không có item khớp → NOT_FOUND', () => {
      const res = http(200, {
        code: 0,
        data: { items: [order({ requestId: 'TX10' })] },
      });
      expect(classifyOrdersLookup(spec, res, 'TX1', trace).result.outcome).toBe(
        'NOT_FOUND',
      );
    });

    it.each([
      http(401, { code: 2002 }),
      http(500, { code: 5000 }),
      http(200, { code: 1000 }),
    ])('lỗi khi tra cứu không bao giờ làm đơn FAILED', (res) => {
      expect(classifyOrdersLookup(spec, res, 'TX1', trace).result.outcome).toBe(
        'UNKNOWN',
      );
    });
  });

  describe('danh sách gói', () => {
    it('đọc gói về dạng chuẩn, bỏ phần tử thiếu mã', () => {
      const reading = readPackages(
        spec,
        http(200, {
          code: 0,
          data: {
            items: [
              {
                id: 'plan-esim-5gb',
                name: 'eSIM 5GB',
                type: 'ESIM',
                price: '95000.00',
              },
              { name: 'không có id' },
            ],
          },
        }),
      );
      expect(reading).toMatchObject({
        ok: true,
        packages: [
          {
            code: 'plan-esim-5gb',
            name: 'eSIM 5GB',
            price: 95000,
            description: 'ESIM',
          },
        ],
      });
    });

    it('phản hồi lỗi: không có gói, kèm thông báo', () => {
      expect(
        readPackages(spec, http(200, { code: 2002, message: 'Invalid key' })),
      ).toMatchObject({ ok: false, message: 'Invalid key' });
    });
  });

  describe('request gửi đi', () => {
    const secrets = { apiKey: 'ANI_SECRET_KEY_123' };

    it('tạo đơn: POST JSON, header X-API-Key, bỏ serial khi rỗng', () => {
      const built = buildRequest(
        spec,
        spec.submit.request,
        'https://ap1.anipay.vn/',
        requestScope(params, secrets, {
          transCode: 'TX1',
          action: 'ACTIVATE_SIM',
          packageCode: 'plan-uuid',
          phone: null,
          serial: null,
          supplierTransId: null,
        }),
        'submit',
      );
      expect(built.method).toBe('POST');
      expect(built.url).toBe('https://ap1.anipay.vn/api/v1/agency/orders');
      expect(built.headers['X-API-Key']).toBe('ANI_SECRET_KEY_123');
      expect(JSON.parse(built.rawBody!)).toEqual({
        requestId: 'TX1',
        packagePlanId: 'plan-uuid',
      });
    });

    it('tra cứu bằng danh sách đơn: GET kèm keyword = mã đơn', () => {
      expect(spec.query.source).toBe('ORDERS');
      const built = buildRequest(
        spec,
        spec.orders.request,
        'https://ap1.anipay.vn',
        requestScope(params, secrets, {
          transCode: 'TX1',
          action: '',
          packageCode: '',
          phone: null,
          serial: null,
          supplierTransId: null,
        }),
        'orders',
      );
      expect(built.url).toBe(
        'https://ap1.anipay.vn/api/v1/agency/orders?keyword=TX1&page=0&limit=50',
      );
      expect(built.rawBody).toBeUndefined();
    });

    it('trace che giá trị API key dù tên header do người dùng đặt', () => {
      const masked = maskSecretValues(
        {
          headers: { 'X-API-Key': 'ANI_SECRET_KEY_123' },
          url: 'x?k=ANI_SECRET_KEY_123',
        },
        secrets,
      );
      expect(JSON.stringify(masked)).not.toContain('ANI_SECRET_KEY_123');
    });
  });

  describe('callback', () => {
    it('đọc eventId, requestId và trạng thái', () => {
      const reading = readCallback(
        spec,
        { event: 'ORDER_RESULT', eventId: 'EV1', data: order({ status: 4 }) },
        {},
        trace,
      );
      expect(reading).toMatchObject({
        eventId: 'EV1',
        transCode: 'TX1',
        accepted: true,
      });
      expect(reading.classified.result.outcome).toBe('SUCCESS');
    });

    it('lấy eventId và loại sự kiện từ header khi body không có', () => {
      const reading = readCallback(
        spec,
        { data: order({ status: 5, errorCode: '7' }) },
        { 'x-mk-callback-id': 'EV2', 'x-mk-callback-event': 'ORDER_RESULT' },
        trace,
      );
      expect(reading.eventId).toBe('EV2');
      expect(reading.classified.result.error?.code).toBe('ANI_7');
    });

    it('sự kiện khác ORDER_RESULT thì bỏ qua', () => {
      const reading = readCallback(
        spec,
        { event: 'TOPUP_DONE', eventId: 'EV3', data: order() },
        {},
        trace,
      );
      expect(reading.accepted).toBe(false);
    });
  });
});
