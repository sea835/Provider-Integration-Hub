import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HttpConfigAdapter } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.adapter';
import {
  HttpJsonClient,
  HttpRequest,
  HttpResult,
} from '@modules/provider-adapter/infrastructure/http/http-json.client';
import { SupplierContext } from '@modules/provider-adapter/domain/provider-adapter.port';
import { InvalidCallbackPayloadError } from '@modules/provider-adapter/domain/adapter.errors';
import { TokenManager } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.token-manager';
import {
  MemoryTokenStore,
  PlainCipher,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.test-support';

const integration = (name: string) =>
  JSON.parse(
    readFileSync(
      join(__dirname, `../../../../../../tools/integrations/${name}.json`),
      'utf8',
    ),
  ) as Record<string, unknown>;
const anisim = integration('anisim');
const momo = integration('momo');

function ctx(params: Record<string, unknown>): SupplierContext {
  return {
    supplierId: 's1',
    supplierCode: 'ANISIM',
    baseUrl: 'https://ap1.anipay.vn',
    secrets: { apiKey: 'K_SECRET_1234' },
    params,
    timeouts: { submitMs: 1000, queryMs: 500 },
    configVersion: 1,
  };
}

const cmd = {
  transCode: 'TX1',
  action: 'ACTIVATE_SIM' as const,
  packageCode: 'plan',
  phone: null,
  serial: null,
};

describe('HttpConfigAdapter', () => {
  let sent: HttpRequest[];
  let adapter: HttpConfigAdapter;

  beforeEach(() => {
    sent = [];
    const http = {
      request: jest.fn((req: HttpRequest) => {
        sent.push(req);
        return Promise.resolve({
          ok: true,
          status: 201,
          body: { code: 0, data: { id: 'ani-1', requestId: 'TX1', status: 1 } },
          rawText: '',
          headers: {},
          durationMs: 4,
        });
      }),
    };
    const client = http as unknown as HttpJsonClient;
    adapter = new HttpConfigAdapter(
      client,
      new TokenManager(client, new MemoryTokenStore(), new PlainCipher()),
    );
  });

  it('gửi đơn theo bản tích hợp; trace không lộ API key', async () => {
    const result = await adapter.submit(ctx(anisim), cmd);
    expect(result.outcome).toBe('PENDING');
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: 'https://ap1.anipay.vn/api/v1/agency/orders',
      timeoutMs: 1000,
    });
    expect(sent[0].headers?.['X-API-Key']).toBe('K_SECRET_1234');
    expect(JSON.stringify(result.trace)).not.toContain('K_SECRET_1234');
  });

  it('cấu hình chưa đủ thì không gửi gì, đơn thất bại vì cấu hình', async () => {
    const result = await adapter.submit(ctx({}), cmd);
    expect(result).toMatchObject({
      outcome: 'FAILED',
      error: { code: 'SUPPLIER_CONFIG' },
    });
    expect(sent).toHaveLength(0);
  });

  it('thao tác hỗ trợ lấy theo cấu hình của từng NCC', () => {
    expect(adapter.supportedActions(ctx(anisim))).toEqual(['ACTIVATE_SIM']);
  });

  it('chưa bật callback thì từ chối callback', () => {
    expect(() =>
      adapter.parseCallback(ctx({}), {
        body: { eventId: 'E' },
        headers: {},
        ip: '1.1.1.1',
      }),
    ).toThrow(InvalidCallbackPayloadError);
  });

  it('chưa nhập đường dẫn kiểm tra kết nối thì báo rõ, không gọi NCC', async () => {
    await expect(adapter.testConnection(ctx({}))).resolves.toMatchObject({
      ok: false,
    });
    expect(sent).toHaveLength(0);
  });
});

describe('HttpConfigAdapter với đăng nhập lấy token (MoMo)', () => {
  const momoCtx: SupplierContext = {
    supplierId: 's2',
    supplierCode: 'MOMO',
    baseUrl: 'https://momo.test',
    secrets: { password: 'pw_demo_1234', secretKey: 'sk_demo_5678' },
    params: momo,
    timeouts: { submitMs: 1000, queryMs: 500 },
    configVersion: 3,
  };
  const order = {
    transCode: 'PQ1',
    action: 'BUY_DATA' as const,
    packageCode: '1N_TMDT',
    phone: '0912345678',
    serial: null,
  };
  const reply = (status: number, body: unknown): HttpResult => ({
    ok: true,
    status,
    body,
    rawText: JSON.stringify(body),
    headers: {},
    durationMs: 3,
  });
  const created = reply(200, {
    error: 862000000,
    message: 'Success',
    data: { momoTransId: 'M1', partnerTransId: 'PQ1' },
  });

  let sent: HttpRequest[];
  let logins: number;
  let login: () => HttpResult;
  let orders: Array<(token: string | undefined) => HttpResult>;
  let adapter: HttpConfigAdapter;

  beforeEach(() => {
    sent = [];
    logins = 0;
    login = () => {
      logins += 1;
      return reply(200, {
        error: 866000000,
        message: 'Success',
        accessToken: `tok-${logins}`,
      });
    };
    orders = [];
    const http = {
      request: jest.fn((req: HttpRequest) => {
        sent.push(req);
        if (req.url.endsWith('/telco/partner/login')) {
          return Promise.resolve(login());
        }
        const token = req.headers?.Authorization?.replace('Bearer ', '');
        const handler = orders.shift() ?? (() => created);
        return Promise.resolve(handler(token));
      }),
    } as unknown as HttpJsonClient;
    adapter = new HttpConfigAdapter(
      http,
      new TokenManager(http, new MemoryTokenStore(), new PlainCipher()),
    );
  });

  const paths = () => sent.map((req) => new URL(req.url).pathname);

  it('đăng nhập trước, gửi đơn kèm Bearer; đơn sau dùng lại token', async () => {
    await expect(adapter.submit(momoCtx, order)).resolves.toMatchObject({
      outcome: 'PENDING',
      supplierTransId: 'M1',
    });
    await adapter.submit(momoCtx, { ...order, transCode: 'PQ2' });
    expect(paths()).toEqual([
      '/telco/partner/login',
      '/telco/v1/orders/create',
      '/telco/v1/orders/create',
    ]);
    expect(sent[1].headers?.Authorization).toBe('Bearer tok-1');
    expect(sent[2].headers?.Authorization).toBe('Bearer tok-1');
  });

  it('NCC báo token hết hạn: đăng nhập lại và gửi lại đúng một lần với requestId mới', async () => {
    orders.push(() => reply(401, { error: 866300020, message: 'Expired' }));
    const result = await adapter.submit(momoCtx, order);
    expect(result.outcome).toBe('PENDING');
    expect(paths()).toEqual([
      '/telco/partner/login',
      '/telco/v1/orders/create',
      '/telco/partner/login',
      '/telco/v1/orders/create',
    ]);
    expect(sent[3].headers?.Authorization).toBe('Bearer tok-2');
    expect(sent[3].headers?.requestId).not.toBe(sent[1].headers?.requestId);
  });

  it('token mới vẫn bị từ chối thì không gửi thêm, đơn thất bại vì cấu hình', async () => {
    const expired = () => reply(401, { error: 866300002, message: 'Invalid' });
    orders.push(expired, expired, expired);
    await expect(adapter.submit(momoCtx, order)).resolves.toMatchObject({
      outcome: 'FAILED',
      error: { code: 'SUPPLIER_CONFIG' },
    });
    expect(paths().filter((p) => p.endsWith('/create'))).toHaveLength(2);
  });

  it('sai tài khoản đăng nhập: không gửi đơn, đơn thất bại vì cấu hình', async () => {
    login = () =>
      reply(200, {
        error: 866300001,
        message: 'Unauthorized',
        accessToken: null,
      });
    await expect(adapter.submit(momoCtx, order)).resolves.toMatchObject({
      outcome: 'FAILED',
      error: { code: 'SUPPLIER_CONFIG' },
    });
    expect(paths()).toEqual(['/telco/partner/login']);
  });

  it('không kết nối được máy chủ đăng nhập: chưa biết, Hub thử lại sau', async () => {
    login = () => reply(503, 'down');
    await expect(adapter.submit(momoCtx, order)).resolves.toMatchObject({
      outcome: 'UNKNOWN',
      error: { code: 'TOKEN_UNAVAILABLE' },
    });
    await expect(
      adapter.query(momoCtx, { transCode: 'PQ1', supplierTransId: null }),
    ).resolves.toMatchObject({ outcome: 'UNKNOWN' });
    expect(paths().every((p) => p === '/telco/partner/login')).toBe(true);
  });

  it('lấy lại token thất bại vì mạng thì chưa biết, không đánh thất bại', async () => {
    orders.push(() => reply(401, { error: 866300020 }));
    let attempt = 0;
    login = () => {
      attempt += 1;
      return attempt === 1
        ? reply(200, { error: 866000000, accessToken: 'tok-1' })
        : reply(502, 'bad gateway');
    };
    await expect(adapter.submit(momoCtx, order)).resolves.toMatchObject({
      outcome: 'UNKNOWN',
      error: { code: 'TOKEN_UNAVAILABLE' },
    });
  });

  it('trace không lộ token, mật khẩu, khoá ký', async () => {
    const result = await adapter.submit(momoCtx, order);
    const text = JSON.stringify(result.trace);
    expect(text).not.toContain('tok-1');
    expect(text).not.toContain('sk_demo_5678');
    expect(text).toContain('signature');
  });

  it('kiểm tra kết nối báo đã đăng nhập được', async () => {
    orders.push(() =>
      reply(200, { error: 862000000, data: { availBalance: 5000000 } }),
    );
    await expect(adapter.testConnection(momoCtx)).resolves.toMatchObject({
      ok: true,
      message: expect.stringContaining('Đăng nhập được.') as unknown,
    });
  });
});
