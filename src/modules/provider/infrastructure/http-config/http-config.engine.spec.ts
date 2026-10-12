import { createHash, createHmac } from 'node:crypto';
import {
  buildRequest,
  needsTokenRefresh,
  readBalance,
  readToken,
  requestBaseUrl,
  requestScope,
} from '@modules/provider/infrastructure/http-config/http-config.engine';
import {
  configOf,
  okResponse,
} from '@modules/provider/infrastructure/http-config/http-config.test-support';
import { HttpResult } from '@modules/provider/infrastructure/http/http-json.client';

type HttpOk = Extract<HttpResult, { ok: true }>;
const ok = (body: unknown, status = 200) => okResponse(body, status) as HttpOk;

describe('buildRequest', () => {
  it('ghép Base URL, path, query, header và xác thực Bearer bằng token', () => {
    const config = configOf({
      baseUrl: 'https://api.partner.test/',
      vars: { partnerCode: 'PQ01' },
      spec: {
        auth: { type: 'BEARER', value: '{{token}}' },
        headers: [{ name: 'X-Partner', value: '{{vars.partnerCode}}' }],
        balance: {
          request: {
            method: 'GET',
            path: '/v1/balance',
            query: [
              { name: 'code', value: '{{vars.partnerCode}}' },
              { name: 'empty', value: '{{vars.none}}', omitIfEmpty: true },
            ],
          },
        },
      },
    });
    const built = buildRequest(
      config.spec,
      config.spec.balance.request,
      config.baseUrl,
      requestScope(config, {}, 'TOKEN1'),
      'balance',
    );
    expect(built.url).toBe('https://api.partner.test/v1/balance?code=PQ01');
    expect(built.headers).toEqual({
      Authorization: 'Bearer TOKEN1',
      'X-Partner': 'PQ01',
    });
    expect(built.rawBody).toBeUndefined();
  });

  it('body JSON giữ kiểu số và đặt được trường lồng nhau; đường dẫn tuyệt đối gọi thẳng', () => {
    const config = configOf({
      baseUrl: 'https://api.partner.test',
      vars: { amount: '15' },
      spec: {
        auth: { type: 'BASIC', username: 'u', password: '{{secrets.pw}}' },
        balance: {
          request: {
            method: 'POST',
            path: 'https://other.test/balance',
            body: [
              { key: 'account.id', value: 'A1' },
              { key: 'amount', value: '{{vars.amount}}', type: 'number' },
            ],
          },
        },
      },
    });
    const built = buildRequest(
      config.spec,
      config.spec.balance.request,
      config.baseUrl,
      requestScope(config, { pw: 'p@ss' }),
      'balance',
    );
    expect(built.url).toBe('https://other.test/balance');
    expect(JSON.parse(built.rawBody as string)).toEqual({
      account: { id: 'A1' },
      amount: 15,
    });
    expect(built.headers.Authorization).toBe(
      `Basic ${Buffer.from('u:p@ss').toString('base64')}`,
    );
  });

  it('ký HMAC-SHA256 trên body thô và gắn vào header; không ký lời gọi không được chọn', () => {
    const config = configOf({
      baseUrl: 'https://api.partner.test',
      spec: {
        signature: {
          enabled: true,
          algorithm: 'HMAC_SHA256',
          key: '{{secrets.signKey}}',
          input: 'BODY',
          encoding: 'HEX_UPPER',
          target: 'HEADER',
          name: 'X-Signature',
          apply: { login: false, balance: true },
        },
        token: { request: { method: 'POST', path: '/login' } },
        balance: {
          request: {
            method: 'POST',
            path: '/balance',
            body: [{ key: 'partner', value: 'PQ01' }],
          },
        },
      },
    });
    const scope = requestScope(config, { signKey: 'k3y' });
    const built = buildRequest(
      config.spec,
      config.spec.balance.request,
      config.baseUrl,
      scope,
      'balance',
    );
    const expected = createHmac('sha256', 'k3y')
      .update('{"partner":"PQ01"}')
      .digest('hex')
      .toUpperCase();
    expect(built.signedPayload).toBe('{"partner":"PQ01"}');
    expect(built.headers['X-Signature']).toBe(expected);

    const login = buildRequest(
      config.spec,
      config.spec.token.request,
      config.baseUrl,
      scope,
      'login',
    );
    expect(login.headers['X-Signature']).toBeUndefined();
  });

  it('ký MD5 trên mẫu tự ghép và gắn vào trường body; GET thì gắn vào URL', () => {
    const raw = {
      baseUrl: 'https://api.partner.test',
      vars: { partnerCode: 'PQ01' },
      spec: {
        signature: {
          enabled: true,
          algorithm: 'MD5',
          input: 'TEMPLATE',
          template: '{{vars.partnerCode}}|{{secrets.secretKey}}',
          encoding: 'HEX',
          target: 'BODY_FIELD',
          name: 'sign',
          apply: { balance: true },
        },
        balance: {
          request: {
            method: 'POST',
            path: '/balance',
            body: [{ key: 'partner', value: 'PQ01' }],
          },
        },
      },
    };
    const expected = createHash('md5').update('PQ01|s3c').digest('hex');
    const post = configOf(raw);
    const built = buildRequest(
      post.spec,
      post.spec.balance.request,
      post.baseUrl,
      requestScope(post, { secretKey: 's3c' }),
      'balance',
    );
    expect(JSON.parse(built.rawBody as string)).toEqual({
      partner: 'PQ01',
      sign: expected,
    });

    const get = configOf({
      ...raw,
      spec: {
        ...raw.spec,
        balance: { request: { method: 'GET', path: '/balance' } },
      },
    });
    const viaUrl = buildRequest(
      get.spec,
      get.spec.balance.request,
      get.baseUrl,
      requestScope(get, { secretKey: 's3c' }),
      'balance',
    );
    expect(viaUrl.url).toBe(
      `https://api.partner.test/balance?sign=${expected}`,
    );
  });
});

describe('requestBaseUrl', () => {
  const config = configOf({
    baseUrl: 'https://api.partner.test',
    hosts: [{ key: 'auth', url: 'https://id.partner.test' }],
    spec: {
      token: { request: { host: 'auth', method: 'POST', path: '/login' } },
      balance: { request: { method: 'GET', path: '/balance' } },
    },
  });

  it('request chọn địa chỉ có tên thì gọi tới địa chỉ đó, còn lại dùng Base URL mặc định', () => {
    const scope = requestScope(config, {});
    const login = buildRequest(
      config.spec,
      config.spec.token.request,
      requestBaseUrl(config, config.spec.token.request),
      scope,
      'login',
    );
    const balance = buildRequest(
      config.spec,
      config.spec.balance.request,
      requestBaseUrl(config, config.spec.balance.request),
      scope,
      'balance',
    );
    expect(login.url).toBe('https://id.partner.test/login');
    expect(balance.url).toBe('https://api.partner.test/balance');
  });

  it('địa chỉ không còn trong danh sách: ném lỗi có tên địa chỉ', () => {
    expect(() =>
      requestBaseUrl({ ...config, hosts: [] }, config.spec.token.request),
    ).toThrow('Chưa khai báo Base URL "auth"');
  });
});

describe('readBalance', () => {
  const config = configOf({
    spec: {
      balance: {
        success: [
          { path: 'http.status', operator: 'IN', values: ['2xx'] },
          { path: 'body.error', operator: 'IN', values: ['0'] },
        ],
        balancePath: 'body.data.balance',
        errorCodePath: 'body.error',
        errorMessagePath: 'body.message',
      },
    },
  });

  it('đọc số và chuỗi số thuần, nhân hệ số đơn vị', () => {
    expect(
      readBalance(config.spec, ok({ error: 0, data: { balance: 1500 } }), 1000),
    ).toEqual({ ok: true, balance: 1_500_000, rawValue: '1500' });
    expect(
      readBalance(
        config.spec,
        ok({ error: 0, data: { balance: ' 250000.50 ' } }),
        1,
      ),
    ).toEqual({ ok: true, balance: 250000.5, rawValue: '250000.50' });
  });

  it('từ chối chuỗi có dấu phân cách nghìn hoặc ký hiệu tiền tệ', () => {
    for (const value of ['1.234.567', '1,234,567', '500000 VND', '']) {
      const reading = readBalance(
        config.spec,
        ok({ error: 0, data: { balance: value } }),
        1,
      );
      expect(reading.ok).toBe(false);
    }
  });

  it('không đạt điều kiện thành công: lưu mã lỗi và thông điệp của đối tác', () => {
    expect(
      readBalance(config.spec, ok({ error: 1006, message: 'Sai chữ ký' }), 1),
    ).toEqual({
      ok: false,
      errorCode: '1006',
      errorMessage: 'Đối tác báo không thành công: Sai chữ ký',
    });
    expect(readBalance(config.spec, ok(null, 500), 1)).toMatchObject({
      ok: false,
      errorCode: 'HTTP_500',
    });
  });

  it('chưa khai báo đường dẫn số dư: BALANCE_PATH_MISSING (gọi thử để chọn trường)', () => {
    const unmapped = configOf({
      spec: { balance: { request: { method: 'GET', path: '/balance' } } },
    });
    expect(
      readBalance(unmapped.spec, ok({ data: { balance: 5 } }), 1),
    ).toMatchObject({ ok: false, errorCode: 'BALANCE_PATH_MISSING' });
  });

  it('thiếu trường số dư: BALANCE_NOT_FOUND', () => {
    expect(
      readBalance(config.spec, ok({ error: 0, data: {} }), 1),
    ).toMatchObject({ ok: false, errorCode: 'BALANCE_NOT_FOUND' });
  });
});

describe('readToken / needsTokenRefresh', () => {
  const config = configOf({
    spec: {
      token: {
        enabled: true,
        request: { method: 'POST', path: '/login' },
        tokenPath: 'body.data.token',
        expiresInPath: 'body.data.expiresIn',
        ttlSec: 3600,
      },
    },
  });

  it('đọc token và hạn dùng; thiếu hạn thì dùng ttlSec', () => {
    expect(
      readToken(config.spec, ok({ data: { token: 'T1', expiresIn: 600 } })),
    ).toEqual({ ok: true, token: 'T1', ttlSec: 600 });
    expect(readToken(config.spec, ok({ data: { token: 'T1' } }))).toEqual({
      ok: true,
      token: 'T1',
      ttlSec: 3600,
    });
  });

  it('không thấy token: REJECTED; lỗi mạng: TRANSPORT', () => {
    expect(
      readToken(config.spec, ok({ message: 'Sai mật khẩu' }, 401)),
    ).toEqual({
      ok: false,
      reason: 'REJECTED',
      message: 'Sai mật khẩu (không thấy token ở body.data.token)',
    });
    expect(
      readToken(config.spec, {
        ok: false,
        kind: 'TIMEOUT',
        message: 'Hết thời gian chờ',
        durationMs: 1,
      }),
    ).toMatchObject({ ok: false, reason: 'TRANSPORT' });
  });

  it('401 mặc định là tín hiệu lấy token mới', () => {
    expect(needsTokenRefresh(config.spec, ok({}, 401))).toBe(true);
    expect(needsTokenRefresh(config.spec, ok({}, 200))).toBe(false);
  });
});
