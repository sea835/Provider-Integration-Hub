import { createHmac } from 'node:crypto';
import {
  buildRequest,
  requestScope,
  UnknownHostError,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.engine';
import {
  HttpConfigParams,
  RequestSpec,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.types';
import {
  parseParams,
  readinessIssues,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.validation';

const BASE = 'https://api.momo.test/telco';

function parse(spec: Record<string, unknown>): HttpConfigParams {
  const { params, issues } = parseParams({ secretKeys: ['k'], spec });
  expect(issues).toEqual([]);
  return params;
}

function build(params: HttpConfigParams, request: Partial<RequestSpec>) {
  const full: RequestSpec = {
    host: '',
    method: 'GET',
    path: '/v1/products',
    query: [],
    bodyType: 'NONE',
    body: [],
    ...request,
  };
  return buildRequest(
    params.spec,
    full,
    BASE,
    requestScope(params, { k: 'secret' }, null),
    'packages',
  );
}

const hosts = [
  {
    key: 'payment',
    label: 'Máy chủ thanh toán',
    url: 'https://payment.momo.test/api/',
  },
  { key: 'auth', label: 'Đăng nhập', url: 'https://auth.momo.test' },
];

describe('Địa chỉ gốc có tên', () => {
  it('không chọn → dùng Base URL của NCC (cấu hình cũ giữ nguyên)', () => {
    expect(build(parse({}), {}).url).toBe(`${BASE}/v1/products`);
  });

  it('chọn địa chỉ có tên → ghép đường dẫn vào đúng địa chỉ đó', () => {
    const params = parse({ hosts });
    expect(build(params, { host: 'payment', path: '/v1/orders' }).url).toBe(
      'https://payment.momo.test/api/v1/orders',
    );
    expect(build(params, { host: 'auth', path: 'token' }).url).toBe(
      'https://auth.momo.test/token',
    );
  });

  it('đổi URL ở một chỗ → mọi API chọn địa chỉ đó đổi theo', () => {
    const sandbox = parse({ hosts });
    const production = parse({
      hosts: [{ ...hosts[0], url: 'https://payment.momo.vn' }, hosts[1]],
    });
    expect(build(sandbox, { host: 'payment', path: '/x' }).url).toBe(
      'https://payment.momo.test/api/x',
    );
    expect(build(production, { host: 'payment', path: '/x' }).url).toBe(
      'https://payment.momo.vn/x',
    );
  });

  it('đường dẫn đầy đủ https://... vẫn gọi thẳng', () => {
    expect(
      build(parse({ hosts }), {
        host: 'payment',
        path: 'https://other.test/ping',
      }).url,
    ).toBe('https://other.test/ping');
  });

  it('chữ ký trên {{request.path}} / {{request.query}} dùng đúng URL trên địa chỉ phụ', () => {
    const params = parse({
      hosts,
      signature: {
        enabled: true,
        rules: [
          {
            algorithm: 'HMAC_SHA256',
            key: '{{secrets.k}}',
            input: 'TEMPLATE',
            template: '{{request.path}}',
            target: 'HEADER',
            name: 'x-sign',
            apply: { packages: true },
          },
        ],
      },
    });
    const built = build(params, {
      host: 'payment',
      path: '/v1/orders',
      query: [{ name: 'page', value: '0', omitIfEmpty: false }],
    });
    expect(built.signedPayload).toBe('/api/v1/orders?page=0');
    expect(built.headers['x-sign']).toBe(
      createHmac('sha256', 'secret')
        .update('/api/v1/orders?page=0')
        .digest('hex'),
    );
  });

  it('chọn địa chỉ không còn trong danh sách → báo lỗi rõ, không gọi nhầm Base URL', () => {
    expect(() => build(parse({ hosts }), { host: 'gone' })).toThrow(
      UnknownHostError,
    );
  });

  it('cảnh báo API dùng địa chỉ đã xoá và địa chỉ chưa nhập URL', () => {
    const params = parse({
      hosts: [{ key: 'payment', label: '', url: '' }],
      submit: { request: { host: 'pay', method: 'POST', path: '/orders' } },
    });
    expect(readinessIssues(params)).toEqual(
      expect.arrayContaining([
        'Địa chỉ gốc "payment": chưa nhập URL',
        '3. Đăng ký gói: đang gọi tới địa chỉ gốc "pay" nhưng địa chỉ này không còn trong danh sách Địa chỉ gốc',
      ]),
    );
  });

  it('tên trùng, tên sai, URL không phải http(s) → không lưu được', () => {
    const { issues } = parseParams({
      spec: {
        hosts: [
          { key: 'pay', url: 'https://a.test' },
          { key: 'pay', url: 'https://b.test' },
          { key: '1bad', url: 'ftp://c.test' },
        ],
      },
    });
    expect(issues).toEqual([
      'spec.hosts[2].key phải bắt đầu bằng chữ, chỉ gồm chữ, số, gạch dưới (tối đa 30 ký tự)',
      'spec.hosts[2].url phải là địa chỉ http:// hoặc https:// đầy đủ',
      'spec.hosts: trùng tên địa chỉ pay',
    ]);
  });
});
