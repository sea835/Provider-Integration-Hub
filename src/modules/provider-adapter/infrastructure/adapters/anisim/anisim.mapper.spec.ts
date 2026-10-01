import {
  classifyAnisimCreate,
  classifyAnisimQuery,
  mapAnisimOrder,
} from '@modules/provider-adapter/infrastructure/adapters/anisim/anisim.mapper';
import { HttpResult } from '@modules/provider-adapter/infrastructure/http/http-json.client';
import { SUPPLIER_CONFIG_ERROR } from '@modules/provider-adapter/domain/supplier-result';

const trace = { durationMs: 1 };

function http(status: number, body: unknown): HttpResult {
  return {
    ok: true,
    status,
    body,
    rawText: JSON.stringify(body),
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
  totalAmount: '95000.00',
  ...overrides,
});

describe('ANI SIM mapper', () => {
  describe('trạng thái đơn', () => {
    it.each([
      [1, 'PENDING'],
      [2, 'PENDING'],
      [3, 'PENDING'],
      [4, 'SUCCESS'],
      [5, 'FAILED'],
      [6, 'FAILED'],
      [99, 'UNKNOWN'],
    ])('status %s → %s', (status, outcome) => {
      expect(mapAnisimOrder(order({ status }), trace).outcome).toBe(outcome);
    });

    it('chỉ lấy LPA/QR khi qrStatus = 2', () => {
      expect(
        mapAnisimOrder(order({ status: 4, qrStatus: 1 }), trace).delivery,
      ).toEqual({
        msisdn: '1211856324',
        serial: '8984012601500769003',
      });
      expect(
        mapAnisimOrder(order({ status: 4, qrStatus: 2 }), trace).delivery,
      ).toMatchObject({ lpa: 'LPA:1$x$y', qrUrl: 'https://qr' });
    });
  });

  describe('tạo đơn', () => {
    it.each<[string, HttpResult, string, string | null]>([
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
      ['500 / 5000', http(500, { code: 5000 }), 'UNKNOWN', 'ANI_5000'],
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
      const result = classifyAnisimCreate(res, trace);
      expect(result.outcome).toBe(outcome);
      if (code) expect(result.error?.code).toBe(code);
    });

    it('lưu supplierTransId = data.id', () => {
      expect(
        classifyAnisimCreate(http(201, { code: 0, data: order() }), trace)
          .supplierTransId,
      ).toBe('ani-1');
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
      expect(classifyAnisimQuery(res, 'TX1', trace).outcome).toBe('FAILED');
    });

    it('không có item khớp → NOT_FOUND', () => {
      const res = http(200, {
        code: 0,
        data: { items: [order({ requestId: 'TX10' })] },
      });
      expect(classifyAnisimQuery(res, 'TX1', trace).outcome).toBe('NOT_FOUND');
    });

    it.each([
      http(401, { code: 2002 }),
      http(500, { code: 5000 }),
      http(200, { code: 1000 }),
    ])('lỗi khi tra cứu không bao giờ làm đơn FAILED', (res) => {
      expect(classifyAnisimQuery(res, 'TX1', trace).outcome).toBe('UNKNOWN');
    });
  });
});
