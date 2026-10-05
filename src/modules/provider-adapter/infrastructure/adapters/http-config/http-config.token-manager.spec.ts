import { SupplierContext } from '@modules/provider-adapter/domain/provider-adapter.port';
import {
  HttpJsonClient,
  HttpRequest,
  HttpResult,
} from '@modules/provider-adapter/infrastructure/http/http-json.client';
import { TokenManager } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.token-manager';
import {
  MemoryTokenStore,
  PlainCipher,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.test-support';
import { parseParams } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.validation';

const { params } = parseParams({
  secretKeys: ['password'],
  spec: {
    token: {
      enabled: true,
      request: {
        method: 'POST',
        path: '/login',
        body: [{ key: 'password', value: '{{secrets.password}}' }],
      },
      tokenPath: 'data.token',
      expiresInPath: 'data.expiresIn',
      ttlSec: 3600,
    },
  },
});

const ctx = (configVersion = 1): SupplierContext => ({
  supplierId: 's1',
  supplierCode: 'NCC',
  baseUrl: 'https://ncc.test',
  secrets: { password: 'pw_secret' },
  params: {},
  timeouts: { submitMs: 1000, queryMs: 500 },
  configVersion,
});

const ok = (body: unknown): HttpResult => ({
  ok: true,
  status: 200,
  body,
  rawText: JSON.stringify(body),
  headers: {},
  durationMs: 1,
});

describe('TokenManager', () => {
  let store: MemoryTokenStore;
  let calls: HttpRequest[];
  let next: () => HttpResult;
  let manager: TokenManager;

  beforeEach(() => {
    store = new MemoryTokenStore();
    calls = [];
    let counter = 0;
    next = () => {
      counter += 1;
      return ok({ data: { token: `T${counter}`, expiresIn: 600 } });
    };
    const http = {
      request: jest.fn((req: HttpRequest) => {
        calls.push(req);
        return Promise.resolve(next());
      }),
    } as unknown as HttpJsonClient;
    manager = new TokenManager(http, store, new PlainCipher());
  });

  it('đăng nhập một lần rồi dùng lại token đã lưu (mã hoá, hạn trừ 60 giây an toàn)', async () => {
    const setSpy = jest.spyOn(store, 'set');
    await expect(manager.obtain(ctx(), params)).resolves.toMatchObject({
      ok: true,
      token: 'T1',
    });
    await expect(manager.obtain(ctx(), params)).resolves.toMatchObject({
      token: 'T1',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: 'https://ncc.test/login',
      rawBody: '{"password":"pw_secret"}',
    });
    expect(setSpy).toHaveBeenCalledWith(
      'hub:supplier-token:s1:1',
      JSON.stringify({ token: 'T1' }),
      540,
    );
  });

  it('nhiều lời gọi cùng lúc chỉ đăng nhập một lần', async () => {
    const results = await Promise.all(
      [1, 2, 3].map(() => manager.obtain(ctx(), params)),
    );
    expect(results.map((r) => r.ok && r.token)).toEqual(['T1', 'T1', 'T1']);
    expect(calls).toHaveLength(1);
  });

  it('token vừa bị từ chối thì đăng nhập lại; kho đã có token khác thì dùng luôn', async () => {
    await manager.obtain(ctx(), params);
    await expect(manager.obtain(ctx(), params, 'T1')).resolves.toMatchObject({
      token: 'T2',
    });
    await expect(manager.obtain(ctx(), params, 'T1')).resolves.toMatchObject({
      token: 'T2',
    });
    expect(calls).toHaveLength(2);
  });

  it('đổi cấu hình (version mới) thì dùng token mới', async () => {
    await manager.obtain(ctx(1), params);
    await expect(manager.obtain(ctx(2), params)).resolves.toMatchObject({
      token: 'T2',
    });
  });

  it('đăng nhập thất bại thì không lưu gì', async () => {
    next = () => ok({ message: 'Sai mật khẩu' });
    await expect(manager.obtain(ctx(), params)).resolves.toMatchObject({
      ok: false,
      reason: 'REJECTED',
    });
    expect(store.values.size).toBe(0);
  });

  it('tiến trình khác đang đăng nhập thì chờ token của tiến trình đó', async () => {
    await store.lock('hub:supplier-token:s1:1:lock');
    setTimeout(() => {
      void store.set(
        'hub:supplier-token:s1:1',
        JSON.stringify({ token: 'FROM_OTHER' }),
      );
    }, 250);
    await expect(manager.obtain(ctx(), params)).resolves.toMatchObject({
      token: 'FROM_OTHER',
    });
    expect(calls).toHaveLength(0);
  });

  it('token lưu hỏng (không giải mã được) thì đăng nhập lại', async () => {
    store.values.set('hub:supplier-token:s1:1', 'not-json');
    await expect(manager.obtain(ctx(), params)).resolves.toMatchObject({
      token: 'T1',
    });
  });
});
