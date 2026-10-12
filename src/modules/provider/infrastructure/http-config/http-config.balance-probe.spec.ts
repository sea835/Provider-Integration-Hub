import { HttpConfigBalanceProbe } from '@modules/provider/infrastructure/http-config/http-config.balance-probe';
import {
  configOf,
  fakeHttp,
  MemoryTokenStore,
  okResponse,
  PlainCipher,
} from '@modules/provider/infrastructure/http-config/http-config.test-support';
import { TokenManager } from '@modules/provider/infrastructure/http-config/http-config.token-manager';
import {
  HttpRequest,
  HttpResult,
} from '@modules/provider/infrastructure/http/http-json.client';

const config = configOf({
  baseUrl: 'https://93.184.216.34',
  spec: {
    auth: { type: 'BEARER', value: '{{token}}' },
    token: {
      enabled: true,
      request: {
        method: 'POST',
        path: '/login',
        body: [{ key: 'password', value: '{{secrets.password}}' }],
      },
      tokenPath: 'body.token',
    },
    balance: {
      request: { method: 'GET', path: '/balance' },
      balancePath: 'body.data.balance',
    },
  },
});

function probeWith(respond: (req: HttpRequest) => HttpResult) {
  const fake = fakeHttp(respond);
  const tokens = new TokenManager(
    fake.http,
    new MemoryTokenStore(),
    new PlainCipher(),
  );
  return { probe: new HttpConfigBalanceProbe(fake.http, tokens), ...fake };
}

const input = {
  cacheKey: 'p1',
  config,
  secrets: { password: 'pw_secret' },
  unitMultiplier: 1,
};

describe('HttpConfigBalanceProbe', () => {
  it('đăng nhập rồi đọc số dư; bước hiển thị đã che mật khẩu và token', async () => {
    const { probe, calls } = probeWith((req) =>
      req.url.endsWith('/login')
        ? okResponse({ token: 'TOKEN_ABCDEF_123456' })
        : okResponse({ data: { balance: 1250000 } }),
    );
    const result = await probe.probe(input);
    expect(result).toMatchObject({ ok: true, balance: 1250000 });
    expect(calls[1].headers?.Authorization).toBe('Bearer TOKEN_ABCDEF_123456');
    expect(result.steps.map((step) => step.kind)).toEqual(['login', 'balance']);
    const shown = JSON.stringify(result);
    expect(shown).not.toContain('pw_secret');
    expect(shown).not.toContain('TOKEN_ABCDEF_123456');
    expect(result.tokenPreview).toBe('TOKEN_…(19 ký tự)');
  });

  it('401 ở API số dư: đăng nhập lại và gọi lại đúng một lần', async () => {
    let logins = 0;
    let balanceCalls = 0;
    const { probe } = probeWith((req) => {
      if (req.url.endsWith('/login')) {
        logins += 1;
        return okResponse({ token: `TOKEN_NUMBER_${logins}` });
      }
      balanceCalls += 1;
      return balanceCalls === 1
        ? okResponse({ message: 'expired' }, 401)
        : okResponse({ data: { balance: 10 } });
    });
    const result = await probe.probe(input);
    expect(result).toMatchObject({ ok: true, balance: 10 });
    expect(logins).toBe(2);
    expect(balanceCalls).toBe(2);
  });

  it('timeout và 503 là lỗi tạm thời; lỗi nghiệp vụ thì không', async () => {
    const timeout = probeWith((req) =>
      req.url.endsWith('/login')
        ? okResponse({ token: 'TOKEN_ABCDEF_123456' })
        : {
            ok: false,
            kind: 'TIMEOUT',
            message: 'Hết thời gian',
            durationMs: 5,
          },
    );
    await expect(timeout.probe.probe(input)).resolves.toMatchObject({
      ok: false,
      errorCode: 'TIMEOUT',
      transient: true,
    });

    const unavailable = probeWith((req) =>
      req.url.endsWith('/login')
        ? okResponse({ token: 'TOKEN_ABCDEF_123456' })
        : okResponse({}, 503),
    );
    await expect(unavailable.probe.probe(input)).resolves.toMatchObject({
      ok: false,
      errorCode: 'HTTP_503',
      transient: true,
    });

    const missing = probeWith((req) =>
      req.url.endsWith('/login')
        ? okResponse({ token: 'TOKEN_ABCDEF_123456' })
        : okResponse({ data: {} }),
    );
    await expect(missing.probe.probe(input)).resolves.toMatchObject({
      ok: false,
      errorCode: 'BALANCE_NOT_FOUND',
      transient: false,
    });
  });

  it('đăng nhập sai: LOGIN_FAILED, không gọi API số dư', async () => {
    const { probe, calls } = probeWith(() =>
      okResponse({ message: 'Sai mật khẩu' }, 401),
    );
    await expect(probe.probe(input)).resolves.toMatchObject({
      ok: false,
      errorCode: 'LOGIN_FAILED',
      transient: false,
    });
    expect(calls).toHaveLength(1);
  });

  it('gọi thử đăng nhập: chỉ gọi API đăng nhập, trả phản hồi kể cả khi chưa khai báo đường dẫn token', async () => {
    const { probe, calls } = probeWith(() =>
      okResponse({ token: 'TOKEN_ABCDEF_123456', expiresIn: 900 }),
    );
    const done = await probe.probeLogin(input);
    expect(done).toMatchObject({ ok: true, httpStatus: 200 });
    expect(done.steps.map((step) => step.kind)).toEqual(['login']);
    expect(calls).toHaveLength(1);

    const unmapped = configOf({
      baseUrl: 'https://93.184.216.34',
      spec: {
        token: { enabled: true, request: { method: 'POST', path: '/login' } },
      },
    });
    const pending = await probe.probeLogin({ ...input, config: unmapped });
    expect(pending).toMatchObject({
      ok: false,
      errorCode: 'TOKEN_PATH_MISSING',
      httpStatus: 200,
    });
    expect(pending.steps).toHaveLength(1);
    expect(pending.steps[0].response).toMatchObject({
      status: 200,
      body: { token: '***', expiresIn: 900 },
    });
  });

  it('gọi thử đăng nhập khi chưa bật token', async () => {
    const { probe, calls } = probeWith(() => okResponse({}));
    const disabled = configOf({
      baseUrl: 'https://93.184.216.34',
      spec: { balance: { request: { method: 'GET', path: '/balance' } } },
    });
    await expect(
      probe.probeLogin({ ...input, config: disabled }),
    ).resolves.toMatchObject({ ok: false, errorCode: 'LOGIN_DISABLED' });
    expect(calls).toHaveLength(0);
  });

  it('chặn địa chỉ metadata nội bộ', async () => {
    const { probe, calls } = probeWith(() => okResponse({}));
    const blocked = configOf({
      baseUrl: 'http://169.254.169.254',
      spec: {
        balance: {
          request: { method: 'GET', path: '/latest' },
          balancePath: 'body.x',
        },
      },
    });
    await expect(
      probe.probe({ ...input, config: blocked }),
    ).resolves.toMatchObject({ ok: false, errorCode: 'BLOCKED_DESTINATION' });
    expect(calls).toHaveLength(0);
  });
});
