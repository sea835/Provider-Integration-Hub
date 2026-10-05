import { HttpResult } from '@modules/provider-adapter/infrastructure/http/http-json.client';
import {
  buildRequest,
  classifyOrdersLookup,
  classifySubmit,
  mapOrder,
  readCheck,
  readPackages,
  readOrderItems,
  requestScope,
  summarizeOrder,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.engine';
import {
  parseParams,
  readinessIssues,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.validation';

/** Luồng đủ 5 API: danh sách gói, kiểm tra gói, đăng ký, tra cứu, danh sách đơn. */
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

const { params } = parseParams({
  spec: {
    check: {
      enabled: true,
      beforeSubmit: true,
      request: {
        method: 'POST',
        path: '/check',
        body: [{ key: 'msisdn', value: '{{order.phone}}' }],
      },
      eligible: [
        { path: 'body.data.eligible', operator: 'IN', values: ['true'] },
      ],
      ineligible: [
        { path: 'body.data.eligible', operator: 'IN', values: ['false'] },
      ],
      reasonCode: 'body.data.reason',
      reasonMessage: 'body.data.message',
      errorCodePrefix: 'NCC_',
    },
    orders: {
      enabled: true,
      request: {
        method: 'GET',
        path: '/orders',
        query: [
          { name: 'fromDate', value: '{{range.from.date}}' },
          { name: 'to', value: '{{range.to.unix}}' },
          { name: 'keyword', value: '{{order.transCode}}', omitIfEmpty: true },
        ],
      },
      listPath: 'data',
      matchField: 'ref',
      createdAt: 'created',
    },
    order: {
      status: 'state',
      statusMap: [
        { value: 'DONE', outcome: 'SUCCESS' },
        { value: 'FAIL', outcome: 'FAILED' },
      ],
      supplierTransId: 'id',
      errorCodePrefix: 'NCC_',
    },
  },
});
const spec = params.spec;

describe('Kiểm tra gói (API 2)', () => {
  it.each([
    [{ data: { eligible: true } }, true, null],
    [
      { data: { eligible: false, reason: 'NO_QUOTA', message: 'Hết lượt' } },
      false,
      { code: 'NCC_NO_QUOTA', message: 'Hết lượt' },
    ],
    [
      { data: { eligible: false } },
      false,
      {
        code: 'PACKAGE_NOT_ELIGIBLE',
        message: 'Nhà cung cấp báo không đăng ký được gói này',
      },
    ],
    [{ code: 500 }, null, null],
  ])('%j → eligible %s', (body, eligible, reason) => {
    expect(readCheck(spec, http(200, body))).toMatchObject({
      eligible,
      reason,
    });
  });

  it('mất kết nối → chưa rõ (Hub vẫn gửi đơn)', () => {
    expect(
      readCheck(spec, {
        ok: false,
        kind: 'NETWORK',
        message: 'down',
        durationMs: 1,
      }).eligible,
    ).toBeNull();
  });
});

describe('Danh sách đơn (API 5)', () => {
  it('biến khoảng thời gian: ngày theo giờ Việt Nam, unix; bỏ keyword khi không tra cứu', () => {
    const built = buildRequest(
      spec,
      spec.orders.request,
      'https://ncc.test',
      requestScope(params, {}, null, {
        range: {
          from: new Date('2026-10-01T18:30:00Z'),
          to: new Date('2026-10-02T00:00:00Z'),
        },
      }),
      'orders',
    );
    expect(built.url).toBe(
      `https://ncc.test/orders?fromDate=2026-10-02&to=${Date.UTC(2026, 9, 2) / 1000}`,
    );
  });

  it('đọc từng đơn theo bảng trạng thái của Hub', () => {
    const reading = readOrderItems(
      spec,
      http(200, {
        data: [
          { ref: 'TX1', id: 'N1', state: 'DONE', created: '2026-10-01' },
          { ref: 'TX2', id: 'N2', state: 'WEIRD' },
        ],
      }),
    );
    expect(reading.ok).toBe(true);
    expect(reading.items.map((item) => summarizeOrder(spec, item))).toEqual([
      {
        transCode: 'TX1',
        supplierTransId: 'N1',
        status: 'DONE',
        outcome: 'SUCCESS',
        errorCode: null,
        createdAt: '2026-10-01',
      },
      {
        transCode: 'TX2',
        supplierTransId: 'N2',
        status: 'WEIRD',
        outcome: 'UNKNOWN',
        errorCode: 'NCC_UNKNOWN_STATUS',
        createdAt: null,
      },
    ]);
  });
});

describe('Kiểm tra cấu hình 5 API', () => {
  it('bản cũ "tra cứu trả danh sách" tự chuyển sang API danh sách đơn', () => {
    const { params: legacy, issues } = parseParams({
      spec: {
        query: {
          request: { method: 'GET', path: '/orders' },
          orderPath: 'data.items',
          list: true,
          matchField: 'requestId',
        },
      },
    });
    expect(issues).toEqual([]);
    expect(legacy.spec.query.source).toBe('ORDERS');
    expect(legacy.spec.orders).toMatchObject({
      enabled: true,
      request: { path: '/orders' },
      listPath: 'data.items',
      matchField: 'requestId',
    });
  });

  it('báo thiếu phần bắt buộc của từng API đã bật', () => {
    const { params: partial } = parseParams({
      spec: {
        packages: { enabled: true },
        check: { enabled: true },
        orders: { enabled: true },
        query: { source: 'ORDERS' },
      },
    });
    expect(readinessIssues(partial)).toEqual(
      expect.arrayContaining([
        'Danh sách gói: chưa nhập đường dẫn API',
        'Danh sách gói: chưa chọn trường mã gói',
        'Kiểm tra gói: chưa nhập đường dẫn API',
        'Kiểm tra gói: chưa khai báo khi nào là đăng ký được / không được',
        'Danh sách đơn: chưa nhập đường dẫn API',
        'Danh sách đơn: chưa chọn trường chứa mã đơn của Hub (so khớp)',
      ]),
    );
    expect(readinessIssues(partial)).not.toContain(
      'Chưa nhập đường dẫn tra cứu đơn',
    );
  });
});

describe('Đường dẫn dạng danh sách [*]', () => {
  const { params: starParams } = parseParams({
    spec: {
      query: { source: 'ORDERS' },
      orders: {
        enabled: true,
        request: { method: 'GET', path: '/orders' },
        matchField: 'data.items[*].requestId',
      },
      packages: {
        enabled: true,
        request: { method: 'GET', path: '/packages' },
        code: 'data.items[*].id',
        name: 'data.items[*].name',
      },
      order: {
        status: 'data.items[*].status',
        supplierTransId: 'data.items[*].id',
        errorCode: 'data.items[*].errorCode',
        errorCodePrefix: 'ANI_',
        statusMap: [
          { value: '4', outcome: 'SUCCESS' },
          { value: '5', outcome: 'FAILED' },
        ],
        delivery: { lpa: 'data.items[*].esims[0].lpa' },
      },
    },
  });
  const starSpec = starParams.spec;
  const list = http(200, {
    data: {
      items: [
        { id: 'A1', requestId: 'TX10', status: 4 },
        {
          id: 'A2',
          requestId: 'TX1',
          status: 5,
          errorCode: '4012',
          esims: [{ lpa: 'LPA:1$x' }],
        },
      ],
    },
  });

  it('đọc từng đơn trong danh sách; vị trí danh sách lấy từ các ô [*] khi để trống', () => {
    const { result } = classifyOrdersLookup(starSpec, list, 'TX1', {
      durationMs: 0,
    });
    expect(result).toMatchObject({
      outcome: 'FAILED',
      supplierTransId: 'A2',
      error: { code: 'ANI_4012' },
      delivery: { lpa: 'LPA:1$x' },
    });
  });

  it('cùng đường dẫn đọc được đơn đơn lẻ (vd phản hồi gửi đơn)', () => {
    expect(
      mapOrder({ id: 'A3', status: 4 }, starSpec.order, { durationMs: 0 })
        .result,
    ).toMatchObject({ outcome: 'SUCCESS', supplierTransId: 'A3' });
  });

  it('danh sách gói cũng hiểu [*]', () => {
    expect(
      readPackages(
        starSpec,
        http(200, { data: { items: [{ id: 'P1', name: 'Gói 1' }] } }),
      ).packages,
    ).toEqual([{ code: 'P1', name: 'Gói 1', price: null, description: null }]);
  });

  it('cảnh báo khi ô [*] khác vị trí danh sách đã khai báo', () => {
    const { params: mismatch } = parseParams({
      spec: {
        orders: {
          enabled: true,
          request: { method: 'GET', path: '/orders' },
          listPath: 'data.list',
          matchField: 'data.items[*].requestId',
        },
      },
    });
    expect(readinessIssues(mismatch)).toContain(
      'Danh sách đơn: ô Trường so khớp mã đơn đọc trong danh sách data.items[*] nhưng Vị trí danh sách đơn là data.list',
    );
    expect(
      readinessIssues(starParams).filter((issue) => issue.includes(':')),
    ).toEqual([]);
  });
});

describe('Cách lấy kết quả và cách tìm đơn', () => {
  const build = (resultMode: string, matchBy: string) =>
    parseParams({
      spec: {
        submit: { resultMode, orderPath: 'data' },
        orders: {
          enabled: true,
          request: { method: 'GET', path: '/orders' },
          listPath: 'data.items',
          matchBy,
          matchField: 'data.items[*].requestId',
        },
        order: {
          status: 'data.items[*].status',
          supplierTransId: 'data.items[*].id',
          statusMap: [
            { value: '1', outcome: 'PENDING' },
            { value: '4', outcome: 'SUCCESS' },
          ],
          delivery: { msisdn: 'data.items[*].msisdn' },
        },
      },
    }).params.spec;
  const created = http(201, {
    code: 0,
    data: { id: 'ANI-1', requestId: 'TX1', status: 4, msisdn: '0912' },
  });

  it('chờ tra cứu: phản hồi tạo đơn chỉ là đã nhận, lưu mã NCC, không đọc trạng thái', () => {
    expect(
      classifySubmit(build('POLL', 'TRANS_CODE'), created, { durationMs: 0 })
        .result,
    ).toMatchObject({
      outcome: 'PENDING',
      supplierTransId: 'ANI-1',
      delivery: { msisdn: '0912' },
    });
    expect(
      classifySubmit(build('SYNC', 'TRANS_CODE'), created, { durationMs: 0 })
        .result.outcome,
    ).toBe('SUCCESS');
  });

  const list = http(200, {
    data: {
      items: [
        { id: 'ANI-9', requestId: 'TX1', status: 1 },
        { id: 'ANI-1', requestId: 'TX-OTHER', status: 4 },
      ],
    },
  });

  it('tìm theo mã nhà cung cấp khi đã có; chưa có thì tìm theo mã Hub', () => {
    const spec = build('POLL', 'SUPPLIER_ID');
    expect(
      classifyOrdersLookup(spec, list, 'TX1', { durationMs: 0 }, 'ANI-1')
        .result,
    ).toMatchObject({ outcome: 'SUCCESS', supplierTransId: 'ANI-1' });
    expect(
      classifyOrdersLookup(spec, list, 'TX1', { durationMs: 0 }, null).result,
    ).toMatchObject({ outcome: 'PENDING', supplierTransId: 'ANI-9' });
  });

  it('NCC đã nhận đơn (có mã) mà danh sách không có: chưa rõ, không gửi lại', () => {
    const spec = build('POLL', 'SUPPLIER_ID');
    expect(
      classifyOrdersLookup(spec, list, 'TX1', { durationMs: 0 }, 'ANI-404')
        .result,
    ).toMatchObject({
      outcome: 'UNKNOWN',
      error: { code: 'ORDER_NOT_IN_LIST' },
    });
    expect(
      classifyOrdersLookup(
        build('POLL', 'TRANS_CODE'),
        list,
        'TX-NONE',
        { durationMs: 0 },
        null,
      ).result.outcome,
    ).toBe('NOT_FOUND');
  });

  it('tìm theo mã NCC mà chưa chọn ô mã NCC thì cảnh báo', () => {
    const { params } = parseParams({
      spec: { orders: { enabled: true, matchBy: 'SUPPLIER_ID' } },
    });
    expect(readinessIssues(params)).toContain(
      'Danh sách đơn: tìm theo mã nhà cung cấp nhưng chưa chọn ô Mã đơn phía nhà cung cấp (mục Trạng thái đơn)',
    );
  });
});
