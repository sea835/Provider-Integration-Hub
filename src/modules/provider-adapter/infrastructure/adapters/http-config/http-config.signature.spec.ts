import { createHash, createHmac } from 'node:crypto';
import {
  buildRequest,
  requestScope,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.engine';
import {
  HttpConfigParams,
  IntegrationSpec,
  RequestSpec,
  SignatureRule,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.types';
import { parseParams } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.validation';

const KEY = 'k_sign_123';

function setup(
  signature: Partial<SignatureRule> & { enabled?: boolean },
  request: Partial<RequestSpec> = {},
  headers: IntegrationSpec['headers'] = [],
): { params: HttpConfigParams; request: RequestSpec } {
  const { params } = parseParams({
    secretKeys: ['signKey'],
    spec: {
      headers,
      signature: {
        enabled: true,
        key: '{{secrets.signKey}}',
        ...signature,
      },
    },
  });
  return {
    params,
    request: {
      method: 'POST',
      path: '/orders',
      query: [],
      bodyType: 'JSON',
      body: [
        {
          key: 'id',
          value: '{{order.transCode}}',
          type: 'string',
          omitIfEmpty: false,
        },
        { key: 'amount', value: '10000', type: 'number', omitIfEmpty: false },
      ],
      ...request,
    },
  };
}

function build(
  params: HttpConfigParams,
  request: RequestSpec,
  kind: 'submit' | 'query' = 'submit',
) {
  const scope = requestScope(
    params,
    { signKey: KEY },
    {
      transCode: 'TX1',
      action: 'BUY_DATA',
      packageCode: 'P',
      phone: null,
      serial: null,
      supplierTransId: null,
    },
  );
  return buildRequest(params.spec, request, 'https://ncc.test', scope, kind);
}

const hmac = (algorithm: string, payload: string) =>
  createHmac(algorithm, KEY).update(payload);

describe('Chữ ký trong Tự cấu hình', () => {
  const unsigned = '{"id":"TX1","amount":10000}';

  it('HEX_UPPER, gửi trong header, body giữ nguyên', () => {
    const { params, request } = setup({
      encoding: 'HEX_UPPER',
      target: 'HEADER',
      name: 'X-Sign',
    });
    const built = build(params, request);
    const expected = hmac('sha256', unsigned).digest('hex').toUpperCase();
    expect(built.headers['X-Sign']).toBe(expected);
    expect(built.rawBody).toBe(unsigned);
  });

  it('HMAC_SHA512 BASE64', () => {
    const { params, request } = setup({
      algorithm: 'HMAC_SHA512',
      encoding: 'BASE64',
    });
    expect(build(params, request).signature).toBe(
      hmac('sha512', unsigned).digest('base64'),
    );
  });

  it('SHA256 không khoá, ký trên chuỗi tự ghép có request.* và biến', () => {
    const { params, request } = setup({
      algorithm: 'SHA256',
      key: '',
      input: 'TEMPLATE',
      template:
        '{{request.method}}|{{request.path}}|{{request.body}}|{{secrets.signKey}}',
      target: 'HEADER',
      name: 'X-Sign',
    });
    request.query = [{ name: 'v', value: '2', omitIfEmpty: false }];
    const expected = createHash('sha256')
      .update(`POST|/orders?v=2|${unsigned}|${KEY}`)
      .digest('hex');
    expect(build(params, request).headers['X-Sign']).toBe(expected);
  });

  it('body dạng form: thêm trường chữ ký vào form', () => {
    const { params, request } = setup({}, { bodyType: 'FORM' });
    const built = build(params, request);
    const expected = hmac('sha256', 'id=TX1&amount=10000').digest('hex');
    expect(built.rawBody).toBe(`id=TX1&amount=10000&signature=${expected}`);
    expect(built.bodyForTrace).toMatchObject({ signature: expected });
  });

  it('GET không có body: ký chuỗi rỗng, chữ ký thêm vào URL', () => {
    const { params, request } = setup(
      {
        apply: {
          login: false,
          packages: false,
          check: false,
          balance: false,
          submit: false,
          query: true,
          orders: false,
          test: false,
        },
      },
      { method: 'GET', bodyType: 'NONE', body: [] },
    );
    const built = build(params, request, 'query');
    expect(built.url).toBe(
      `https://ncc.test/orders?signature=${hmac('sha256', '').digest('hex')}`,
    );
  });

  it('chỉ ký những lời gọi được chọn', () => {
    const { params, request } = setup({});
    expect(build(params, request, 'query').signature).toBeUndefined();
    expect(build(params, request, 'query').rawBody).toBe(unsigned);
  });

  it('{{uuid}} giống nhau trong cùng lời gọi, khác nhau giữa các lời gọi', () => {
    const { params, request } = setup({ enabled: false }, {}, [
      { name: 'X-Request-Id', value: '{{uuid}}', omitIfEmpty: false },
      { name: 'X-Trace', value: 'hub-{{uuid}}', omitIfEmpty: false },
    ]);
    const first = build(params, request).headers;
    const second = build(params, request).headers;
    expect(first['X-Trace']).toBe(`hub-${first['X-Request-Id']}`);
    expect(second['X-Request-Id']).not.toBe(first['X-Request-Id']);
  });

  it('đường dẫn ghi đầy đủ https://... thì gọi thẳng, không ghép base URL', () => {
    const { params, request } = setup(
      { enabled: false },
      { path: 'https://auth.ncc.test/login' },
    );
    expect(build(params, request).url).toBe('https://auth.ncc.test/login');
  });
});
