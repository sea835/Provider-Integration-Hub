import { createHash, createHmac } from 'node:crypto';
import {
  buildRequest,
  requestScope,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.engine';
import {
  CallKind,
  HttpConfigParams,
  RequestSpec,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.types';
import {
  parseParams,
  readinessIssues,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.validation';

const KEY = 'k_rules_123';

const get = (path: string): RequestSpec => ({
  method: 'GET',
  path,
  query: [{ name: 'page', value: '0', omitIfEmpty: false }],
  bodyType: 'NONE',
  body: [],
});

const post = (path: string): RequestSpec => ({
  method: 'POST',
  path,
  query: [],
  bodyType: 'JSON',
  body: [
    {
      key: 'orderId',
      value: '{{order.transCode}}',
      type: 'string',
      omitIfEmpty: false,
    },
  ],
});

function build(params: HttpConfigParams, request: RequestSpec, kind: CallKind) {
  const scope = requestScope(
    params,
    { signKey: KEY },
    {
      transCode: 'T1',
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
  createHmac(algorithm, KEY).update(payload).digest('hex');

function parse(rules: unknown[]) {
  const { params, issues } = parseParams({
    secretKeys: ['signKey'],
    spec: { signature: { enabled: true, rules } },
  });
  expect(issues).toEqual([]);
  return params;
}

describe('Nhiều quy tắc chữ ký', () => {
  const params = parse([
    {
      label: 'Ký GET',
      methods: ['GET'],
      algorithm: 'HMAC_MD5',
      key: '{{secrets.signKey}}',
      input: 'TEMPLATE',
      template: '{{request.query}}',
      target: 'HEADER',
      name: 'x-signature',
      apply: { packages: true, query: true, orders: true },
    },
    {
      label: 'Ký tạo đơn',
      algorithm: 'HMAC_SHA256',
      key: '{{secrets.signKey}}',
      input: 'TEMPLATE',
      template: 'orderId={{order.transCode}}',
      target: 'BODY_FIELD',
      name: 'data.sign',
      apply: { submit: true },
    },
    {
      label: 'Ký POST còn lại',
      methods: ['POST'],
      algorithm: 'SHA256',
      input: 'BODY',
      target: 'HEADER',
      name: 'x-checksum',
      apply: { query: true },
    },
  ]);

  it('GET dùng quy tắc GET: ký query, gắn header', () => {
    const built = build(params, get('/packages'), 'packages');
    expect(built.signatureRule).toBe('Ký GET');
    expect(built.signedPayload).toBe('page=0');
    expect(built.headers['x-signature']).toBe(hmac('md5', 'page=0'));
  });

  it('tạo đơn dùng quy tắc riêng: ký chuỗi ghép, gắn vào trường lồng nhau', () => {
    const built = build(params, post('/orders'), 'submit');
    expect(built.signatureRule).toBe('Ký tạo đơn');
    expect(JSON.parse(built.rawBody!)).toEqual({
      orderId: 'T1',
      data: { sign: hmac('sha256', 'orderId=T1') },
    });
    expect(built.headers['x-signature']).toBeUndefined();
  });

  it('cùng API tra cứu nhưng POST → bỏ qua quy tắc GET, dùng quy tắc POST', () => {
    const built = build(params, post('/orders/T1/sync'), 'query');
    expect(built.signatureRule).toBe('Ký POST còn lại');
    expect(built.headers['x-checksum']).toBe(
      createHash('sha256').update('{"orderId":"T1"}').digest('hex'),
    );
    expect(built.headers['x-signature']).toBeUndefined();
  });

  it('không quy tắc nào khớp → không ký', () => {
    const built = build(params, get('/ping'), 'test');
    expect(built.signature).toBeUndefined();
    expect(built.signatureRule).toBeUndefined();
  });

  it('quy tắc phía trên đã phủ hết → cảnh báo quy tắc không bao giờ được dùng', () => {
    const shadowed = parse([
      {
        label: 'Mọi lời gọi',
        algorithm: 'MD5',
        name: 'sign',
        apply: { submit: true, query: true },
      },
      {
        label: 'Chỉ POST tạo đơn',
        methods: ['POST'],
        algorithm: 'MD5',
        name: 'sign',
        apply: { submit: true },
      },
    ]);
    expect(readinessIssues(shadowed)).toContain(
      'Chữ ký "Chỉ POST tạo đơn": không bao giờ được dùng vì các quy tắc phía trên đã phủ hết lời gọi của nó',
    );
  });

  it('cấu hình cũ (một chữ ký phẳng) tự thành một quy tắc áp mọi phương thức', () => {
    const { params: legacy, issues } = parseParams({
      secretKeys: ['signKey'],
      spec: {
        signature: {
          enabled: true,
          algorithm: 'HMAC_SHA256',
          key: '{{secrets.signKey}}',
          input: 'BODY',
          target: 'BODY_FIELD',
          name: 'signature',
          apply: { submit: true },
        },
      },
    });
    expect(issues).toEqual([]);
    expect(legacy.spec.signature.rules).toHaveLength(1);
    expect(legacy.spec.signature.rules[0]).toMatchObject({
      methods: [],
      algorithm: 'HMAC_SHA256',
      name: 'signature',
    });
    const built = build(legacy, post('/orders'), 'submit');
    expect(JSON.parse(built.rawBody!)).toEqual({
      orderId: 'T1',
      signature: hmac('sha256', '{"orderId":"T1"}'),
    });
  });

  it('phương thức không hợp lệ bị báo lỗi', () => {
    const { issues } = parseParams({
      spec: {
        signature: {
          enabled: true,
          rules: [{ methods: ['PATCHX'], apply: { submit: true } }],
        },
      },
    });
    expect(issues).toEqual([
      expect.stringContaining('spec.signature.rules[0].methods[0]'),
    ]);
  });
});
