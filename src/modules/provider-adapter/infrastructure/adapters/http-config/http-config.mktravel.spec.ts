import { createHmac } from 'node:crypto';
import {
  buildRequest,
  requestScope,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.engine';
import {
  HttpConfigParams,
  RequestSpec,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.types';
import {
  parseParams,
  readinessIssues,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.validation';

/**
 * MKTravel: x-signature = hex(HMAC-MD5(api_key, message)); message là raw query string
 * với GET, JSON compact của body với request có body, "{}" khi POST không body.
 * Chữ ký mong đợi tính sẵn bằng khoá giả để bắt lệch từng ký tự.
 */
const API_KEY = 'mk_demo_key_123';
const BASE = 'https://partner.mktravel.vn/partner-api';
const TRANS_CODE = '0192a7b3-c4d5-7e8f-9a0b-1c2d3e4f5a6b';

function mktravel(): HttpConfigParams {
  const { params, issues } = parseParams({
    secretKeys: ['apiKey'],
    vars: { keyword: '' },
    spec: {
      auth: { type: 'HEADER', name: 'x-api-key', value: '{{secrets.apiKey}}' },
      signature: {
        enabled: true,
        algorithm: 'HMAC_MD5',
        key: '{{secrets.apiKey}}',
        input: 'TEMPLATE',
        template: '{{request.body||request.query}}',
        encoding: 'HEX',
        target: 'HEADER',
        name: 'x-signature',
        apply: { packages: true, submit: true, query: true },
      },
    },
  });
  expect(issues).toEqual([]);
  return params;
}

function request(overrides: Partial<RequestSpec>): RequestSpec {
  return {
    method: 'GET',
    path: '/v1/products',
    query: [],
    bodyType: 'NONE',
    body: [],
    ...overrides,
  };
}

function build(
  params: HttpConfigParams,
  spec: RequestSpec,
  kind: 'packages' | 'submit' | 'query',
  vars: Record<string, string> = {},
) {
  const scope = requestScope(
    { ...params, vars: { ...params.vars, ...vars } },
    { apiKey: API_KEY },
    {
      transCode: TRANS_CODE,
      action: 'ACTIVATE_SIM',
      packageCode: '8b2f4c9a-7d31-4d6e-9f42-1a6c0f8e3b91',
      phone: null,
      serial: null,
      supplierTransId: null,
    },
  );
  return buildRequest(params.spec, spec, BASE, scope, kind);
}

const md5 = (message: string) =>
  createHmac('md5', API_KEY).update(message).digest('hex');

describe('MKTravel: ký HMAC-MD5 theo {{request.body||request.query}}', () => {
  const params = mktravel();
  const listing = request({
    query: [
      { name: 'page', value: '0', omitIfEmpty: false },
      { name: 'limit', value: '1000', omitIfEmpty: false },
      { name: 'key_words', value: '{{vars.keyword}}', omitIfEmpty: true },
    ],
  });

  it('GET: ký đúng raw query string, giữ thứ tự tham số', () => {
    const built = build(params, listing, 'packages');
    expect(built.url).toBe(`${BASE}/v1/products?page=0&limit=1000`);
    expect(built.signedPayload).toBe('page=0&limit=1000');
    expect(built.headers['x-signature']).toBe(
      '0b240bbd907e6fbeb926546ecaf28289',
    );
    expect(built.headers['x-api-key']).toBe(API_KEY);
  });

  it('GET có tiếng Việt: ký đúng chuỗi đã mã hoá như trên URL gửi đi', () => {
    const built = build(params, listing, 'packages', { keyword: 'Hàn Quốc' });
    const query = 'page=0&limit=1000&key_words=H%C3%A0n+Qu%E1%BB%91c';
    expect(built.url).toBe(`${BASE}/v1/products?${query}`);
    expect(built.signedPayload).toBe(query);
    expect(built.headers['x-signature']).toBe(
      '59851c7393ea796a01caa9d5e333d4be',
    );
  });

  it('GET không có query: ký chuỗi rỗng', () => {
    const built = build(
      params,
      request({
        path: '/v1/transactions/get-by-client-reference/{{order.transCode}}',
      }),
      'query',
    );
    expect(built.url).toBe(
      `${BASE}/v1/transactions/get-by-client-reference/${TRANS_CODE}`,
    );
    expect(built.signedPayload).toBe('');
    expect(built.headers['x-signature']).toBe(
      'ba3cc9537bac776d272b713948b84d8d',
    );
  });

  it('POST: ký JSON compact đúng thứ tự field, đúng chuỗi gửi đi', () => {
    const built = build(
      params,
      request({
        method: 'POST',
        path: '/v1/transactions/esims/async',
        bodyType: 'JSON',
        body: [
          {
            key: 'productId',
            value: '{{order.packageCode}}',
            type: 'string',
            omitIfEmpty: false,
          },
          { key: 'quantity', value: '1', type: 'number', omitIfEmpty: false },
          {
            key: 'activationDate',
            value: '2026-10-05',
            type: 'string',
            omitIfEmpty: false,
          },
          {
            key: 'clientReference',
            value: '{{order.transCode}}',
            type: 'string',
            omitIfEmpty: false,
          },
        ],
      }),
      'submit',
    );
    expect(built.signedPayload).toBe(built.rawBody);
    expect(built.rawBody).toBe(
      `{"productId":"8b2f4c9a-7d31-4d6e-9f42-1a6c0f8e3b91","quantity":1,"activationDate":"2026-10-05","clientReference":"${TRANS_CODE}"}`,
    );
    expect(built.headers['x-signature']).toBe(
      '1732dd87b1ff665770c40e395a40e090',
    );
  });

  it('POST không body: chọn body JSON không trường → gửi và ký "{}"', () => {
    const built = build(
      params,
      request({
        method: 'POST',
        path: '/v1/transactions/abc/sync',
        bodyType: 'JSON',
      }),
      'query',
    );
    expect(built.rawBody).toBe('{}');
    expect(built.signedPayload).toBe('{}');
    expect(built.headers['x-signature']).toBe(md5('{}'));
    expect(built.headers['x-signature']).toBe(
      'e15335635274ab685f896585505bb0d1',
    );
  });
});

describe('Chữ ký nằm trong body', () => {
  it('ký trên chuỗi tự ghép rồi gắn vào trường lồng nhau, chuỗi ký không chứa chữ ký', () => {
    const { params, issues } = parseParams({
      secretKeys: ['apiKey'],
      vars: { partnerCode: 'PQ' },
      spec: {
        signature: {
          enabled: true,
          algorithm: 'HMAC_MD5',
          key: '{{secrets.apiKey}}',
          input: 'TEMPLATE',
          template:
            'partnerCode={{vars.partnerCode}}&requestId={{order.transCode}}&body={{request.body}}',
          encoding: 'HEX',
          target: 'BODY_FIELD',
          name: 'meta.signature',
          apply: { submit: true },
        },
      },
    });
    expect(issues).toEqual([]);
    const built = build(
      params,
      request({
        method: 'POST',
        path: '/orders',
        bodyType: 'JSON',
        body: [
          {
            key: 'requestId',
            value: '{{order.transCode}}',
            type: 'string',
            omitIfEmpty: false,
          },
          {
            key: 'meta.partner',
            value: '{{vars.partnerCode}}',
            type: 'string',
            omitIfEmpty: false,
          },
        ],
      }),
      'submit',
    );
    const unsigned = `{"requestId":"${TRANS_CODE}","meta":{"partner":"PQ"}}`;
    const message = `partnerCode=PQ&requestId=${TRANS_CODE}&body=${unsigned}`;
    expect(built.signedPayload).toBe(message);
    expect(JSON.parse(built.rawBody!)).toEqual({
      requestId: TRANS_CODE,
      meta: { partner: 'PQ', signature: md5(message) },
    });
  });
});

describe('MKTravel: tạo đơn với trường thêm (extra)', () => {
  const { params, issues } = parseParams({
    secretKeys: ['apiKey'],
    spec: {
      extraFields: [
        {
          key: 'activationDate',
          label: 'Ngày kích hoạt',
          type: 'DATE',
          required: true,
        },
        { key: 'iccids', label: 'ICCID', type: 'TEXT_LIST' },
      ],
    },
  });
  const create: RequestSpec = {
    method: 'POST',
    path: '/v1/transactions/esims/async',
    query: [],
    bodyType: 'JSON',
    body: [
      {
        key: 'productId',
        value: '{{order.packageCode}}',
        type: 'string',
        omitIfEmpty: false,
      },
      { key: 'quantity', value: '1', type: 'number', omitIfEmpty: false },
      {
        key: 'activationDate',
        value: '{{order.extra.activationDate||now.date}}',
        type: 'string',
        omitIfEmpty: false,
      },
      {
        key: 'clientReference',
        value: '{{order.transCode}}',
        type: 'string',
        omitIfEmpty: false,
      },
      {
        key: 'iccids',
        value: '{{order.extra.iccids}}',
        type: 'array',
        omitIfEmpty: true,
      },
    ],
  };

  function body(extra: Record<string, unknown>) {
    const scope = requestScope(
      params,
      {},
      {
        transCode: TRANS_CODE,
        action: 'ACTIVATE_SIM',
        packageCode: 'PKG',
        phone: null,
        serial: null,
        supplierTransId: null,
        extra,
      },
    );
    return JSON.parse(
      buildRequest(params.spec, create, BASE, scope, 'submit').rawBody!,
    ) as Record<string, unknown>;
  }

  it('khai báo hợp lệ, không cảnh báo trường thêm', () => {
    expect(issues).toEqual([]);
    expect(params.spec.extraFields.map((field) => field.key)).toEqual([
      'activationDate',
      'iccids',
    ]);
  });

  it('có ngày kích hoạt và ICCID → gửi đúng kiểu, iccids là mảng', () => {
    expect(
      body({ activationDate: '2026-10-15', iccids: ['8988001', '8988002'] }),
    ).toEqual({
      productId: 'PKG',
      quantity: 1,
      activationDate: '2026-10-15',
      clientReference: TRANS_CODE,
      iccids: ['8988001', '8988002'],
    });
  });

  it('không có ICCID → bỏ trường iccids; thiếu ngày → dùng ngày hôm nay', () => {
    const sent = body({});
    expect(sent).not.toHaveProperty('iccids');
    expect(sent.activationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('kiểu danh sách nhận cả chuỗi "a,b" (vd từ biến)', () => {
    const scope = requestScope(params, {}, null);
    const built = buildRequest(
      params.spec,
      {
        ...create,
        body: [
          { key: 'ids', value: 'a, b ,c', type: 'array', omitIfEmpty: false },
        ],
      },
      BASE,
      scope,
      'submit',
    );
    expect(JSON.parse(built.rawBody!)).toEqual({ ids: ['a', 'b', 'c'] });
  });

  it('dùng {{order.extra.X}} chưa khai báo → cảnh báo', () => {
    const { params: missing } = parseParams({
      spec: {
        submit: {
          request: {
            method: 'POST',
            path: '/x',
            bodyType: 'JSON',
            body: [{ key: 'email', value: '{{order.extra.email}}' }],
          },
        },
      },
    });
    expect(readinessIssues(missing)).toContain(
      'Đang dùng {{order.extra.email}} nhưng chưa khai báo trường thêm "email" ở mục Thao tác và trường Store phải gửi',
    );
  });
});
