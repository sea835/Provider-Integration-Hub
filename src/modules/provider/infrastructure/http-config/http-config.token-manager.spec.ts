import { HttpResult } from '@modules/provider/infrastructure/http/http-json.client';
import {
  configOf,
  fakeHttp,
  MemoryTokenStore,
  okResponse,
  PlainCipher,
} from '@modules/provider/infrastructure/http-config/http-config.test-support';
import {
  TokenContext,
  TokenManager,
  tokenKey,
} from '@modules/provider/infrastructure/http-config/http-config.token-manager';

const config = configOf({
  baseUrl: 'https://partner.test',
  spec: {
    token: {
      enabled: true,
      request: {
        method: 'POST',
        path: '/login',
        body: [{ key: 'password', value: '{{secrets.password}}' }],
      },
      tokenPath: 'body.data.token',
      expiresInPath: 'body.data.expiresIn',
      ttlSec: 3600,
    },
  },
});

const ctx = (password = 'pw_secret'): TokenContext => ({
  cacheKey: 'p1',
  config,
  secrets: { password },
  timeoutMs: 500,
});

describe('TokenManager', () => {
  let store: MemoryTokenStore;
  let manager: TokenManager;
  let calls: ReturnType<typeof fakeHttp>['calls'];
  let respond: () => HttpResult;

  beforeEach(() => {
    store = new MemoryTokenStore();
    let counter = 0;
    respond = () => {
      counter += 1;
      return okResponse({ data: { token: `T${counter}`, expiresIn: 600 } });
    };
    const fake = fakeHttp(() => respond());
    calls = fake.calls;
    manager = new TokenManager(fake.http, store, new PlainCipher());
  });

  it('đăng nhập một lần rồi dùng lại token đã lưu (mã hoá, hạn trừ 60 giây an toàn)', async () => {
    const setSpy = jest.spyOn(store, 'set');
    await expect(manager.obtain(ctx())).resolves.toMatchObject({
      ok: true,
      token: 'T1',
      fromCache: false,
    });
    await expect(manager.obtain(ctx())).resolves.toMatchObject({
      ok: true,
      token: 'T1',
      fromCache: true,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://partner.test/login');
    expect(calls[0].rawBody).toBe('{"password":"pw_secret"}');
    expect(setSpy).toHaveBeenCalledWith(
      tokenKey(ctx()),
      'enc:{"token":"T1"}',
      540,
    );
  });

  it('token bị đối tác từ chối: xoá và đăng nhập lại', async () => {
    await manager.obtain(ctx());
    await expect(
      manager.obtain(ctx(), { rejected: 'T1' }),
    ).resolves.toMatchObject({ ok: true, token: 'T2', fromCache: false });
    expect(calls).toHaveLength(2);
  });

  it('nhiều lời gọi cùng lúc chỉ đăng nhập một lần', async () => {
    const results = await Promise.all([
      manager.obtain(ctx()),
      manager.obtain(ctx()),
      manager.obtain(ctx()),
    ]);
    expect(results.map((item) => item.ok && item.token)).toEqual([
      'T1',
      'T1',
      'T1',
    ]);
    expect(calls).toHaveLength(1);
  });

  it('đổi mật khẩu thì dùng khoá kho khác nên đăng nhập lại', async () => {
    await manager.obtain(ctx());
    expect(tokenKey(ctx('new_pw'))).not.toBe(tokenKey(ctx()));
    await expect(manager.obtain(ctx('new_pw'))).resolves.toMatchObject({
      token: 'T2',
      fromCache: false,
    });
  });

  it('đăng nhập ở địa chỉ có tên: gọi đúng địa chỉ, đổi URL thì dùng khoá kho khác', async () => {
    const hosted = (url: string): TokenContext => ({
      ...ctx(),
      config: {
        ...config,
        hosts: [{ key: 'auth', label: '', url }],
        spec: {
          ...config.spec,
          token: {
            ...config.spec.token,
            request: { ...config.spec.token.request, host: 'auth' },
          },
        },
      },
    });
    await manager.obtain(hosted('https://id.partner.test'));
    expect(calls[0].url).toBe('https://id.partner.test/login');
    expect(tokenKey(hosted('https://id2.partner.test'))).not.toBe(
      tokenKey(hosted('https://id.partner.test')),
    );
  });

  it('fresh: luôn đăng nhập dù kho đang có token', async () => {
    await manager.obtain(ctx());
    await expect(manager.obtain(ctx(), { fresh: true })).resolves.toMatchObject(
      { token: 'T2', fromCache: false },
    );
    expect(calls).toHaveLength(2);
  });

  it('đăng nhập thất bại thì không lưu gì', async () => {
    respond = () => okResponse({ message: 'Sai mật khẩu' }, 401);
    await expect(manager.obtain(ctx())).resolves.toMatchObject({
      ok: false,
      reason: 'REJECTED',
    });
    expect(store.data.size).toBe(0);
    expect(store.locks.size).toBe(0);
  });
});
