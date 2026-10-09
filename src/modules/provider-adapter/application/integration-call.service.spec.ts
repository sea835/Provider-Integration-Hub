import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LoggerPort } from '@common/logger';
import { SupplierContext } from '@modules/provider-adapter/domain/provider-adapter.port';
import {
  HttpJsonClient,
  HttpRequest,
  HttpResult,
} from '@modules/provider-adapter/infrastructure/http/http-json.client';
import { IntegrationCallService } from '@modules/provider-adapter/application/integration-call.service';
import { AdapterRegistry } from '@modules/provider-adapter/application/adapter-registry';
import { blockedDestination } from '@modules/provider-adapter/infrastructure/http/destination-guard';
import { TokenManager } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.token-manager';
import {
  MemoryTokenStore,
  PlainCipher,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.test-support';

const momo = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../tools/integrations/momo.json'),
    'utf8',
  ),
) as Record<string, unknown> & { spec: Record<string, unknown> };

const ctx = (baseUrl = 'https://momo.test'): SupplierContext => ({
  supplierId: 's1',
  supplierCode: 'MOMO',
  baseUrl,
  secrets: { password: 'pw_saved_123', secretKey: 'sk_saved_456' },
  params: {},
  timeouts: { submitMs: 1000, queryMs: 500 },
  configVersion: 1,
});

const reply = (status: number, body: unknown): HttpResult => ({
  ok: true,
  status,
  body,
  rawText: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
  durationMs: 7,
});

describe('IntegrationCallService (gọi thử)', () => {
  let sent: HttpRequest[];
  let login: () => HttpResult;
  let other: () => HttpResult;
  let service: IntegrationCallService;

  beforeEach(() => {
    sent = [];
    login = () =>
      reply(200, {
        error: 866000000,
        message: 'Success',
        accessToken: 'tok-live-789',
      });
    other = () =>
      reply(200, {
        error: 862000000,
        message: 'Success',
        data: {
          momoTransId: 'O1',
          partnerTransId: 'PQ1',
          phoneNumber: '0912345678',
          status: 'SUCCESS',
        },
      });
    const http = {
      request: jest.fn((req: HttpRequest) => {
        sent.push(req);
        return Promise.resolve(
          req.url.includes('/partner/login') ? login() : other(),
        );
      }),
    } as unknown as HttpJsonClient;
    const logger = {
      child: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as LoggerPort;
    service = new IntegrationCallService(
      http,
      {} as unknown as AdapterRegistry,
      new TokenManager(http, new MemoryTokenStore(), new PlainCipher()),
      logger,
    );
  });

  const call = (overrides: Record<string, unknown> = {}) =>
    service.call({
      ctx: ctx(),
      adapterType: 'HTTP_CONFIG',
      params: momo,
      kind: 'QUERY',
      order: { transCode: 'PQ1' },
      ...overrides,
    });

  it('tra cứu: đăng nhập mới, gọi GET thật, Hub phân loại ra thành công; mọi bí mật đều bị che', async () => {
    const out = await call();
    expect(out.issues).toEqual([]);
    expect(sent.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual([
      'POST /telco/partner/login',
      'GET /telco/v1/orders/status',
    ]);
    expect(sent[1].headers?.Authorization).toBe('Bearer tok-live-789');
    expect(out.login).toMatchObject({ ok: true });
    expect(out.call?.response).toMatchObject({ ok: true, httpStatus: 200 });
    expect(out.result).toMatchObject({
      outcome: 'SUCCESS',
      supplierTransId: 'O1',
    });
    const text = JSON.stringify(out);
    expect(text).not.toContain('tok-live-789');
    expect(text).not.toContain('pw_saved_123');
    expect(out.call?.request.headers.Authorization).toBe('Bearer ***');
  });

  it('gọi thử lần sau dùng lại token đã lưu, không đăng nhập lại', async () => {
    await call();
    const second = await call();
    expect(sent.filter((r) => r.url.includes('/partner/login'))).toHaveLength(
      1,
    );
    expect(second.tokenReused).toBe(true);
    expect(second.login).toBeNull();
    expect(second.result).toMatchObject({ outcome: 'SUCCESS' });
  });

  it('token đã lưu bị NCC từ chối (401) → đăng nhập lại đúng một lần rồi gọi lại', async () => {
    await call();
    let rejected = true;
    other = () =>
      rejected
        ? ((rejected = false), reply(401, { error: 866300001 }))
        : reply(200, {
            error: 862000000,
            message: 'Success',
            data: {
              momoTransId: 'O1',
              partnerTransId: 'PQ1',
              status: 'SUCCESS',
            },
          });
    let logins = 0;
    login = () => {
      logins += 1;
      return reply(200, {
        error: 866000000,
        message: 'Success',
        accessToken: `tok-new-${logins}`,
      });
    };
    const out = await call();
    expect(logins).toBe(1);
    expect(out.tokenReused).toBe(false);
    expect(out.login).toMatchObject({ ok: true });
    expect(out.result).toMatchObject({ outcome: 'SUCCESS' });
    expect(sent.at(-1)?.headers?.Authorization).toBe('Bearer tok-new-1');
  });

  it('bí mật đang nhập dở được dùng thay bí mật đã lưu', async () => {
    await call({ secrets: { password: 'pw_draft_000', secretKey: '' } });
    expect(sent[0].rawBody).toContain('pw_draft_000');
  });

  it('kiểm tra kết nối: trả OK kèm nguyên phản hồi số dư', async () => {
    other = () =>
      reply(200, { error: 862000000, data: { availBalance: 5000000 } });
    const out = await call({ kind: 'TEST', order: undefined });
    expect(out.result).toMatchObject({ outcome: 'OK' });
    expect(out.call?.response).toMatchObject({
      body: { data: { availBalance: 5000000 } },
    });
  });

  it('đăng nhập bị từ chối: trả phản hồi đăng nhập, không gọi tiếp', async () => {
    login = () =>
      reply(200, {
        error: 866300001,
        message: 'Unauthorized',
        accessToken: null,
      });
    const out = await call();
    expect(out.login).toMatchObject({ ok: false });
    expect(out.call).toBeNull();
    expect(sent).toHaveLength(1);
  });

  it('không gọi request không phải GET (tránh tạo/đổi dữ liệu thật)', async () => {
    const spec = momo.spec as { query: { request: Record<string, unknown> } };
    const params = {
      ...momo,
      spec: {
        ...momo.spec,
        query: {
          ...spec.query,
          request: { ...spec.query.request, method: 'POST' },
        },
      },
    };
    const out = await call({ params });
    expect(out.issues[0]).toContain('Chỉ gọi thử được request GET');
    expect(sent).toHaveLength(0);
  });

  it('thiếu mã đơn khi tra cứu, hoặc không phải loại Tự cấu hình: báo rõ, không gọi', async () => {
    expect((await call({ order: {} })).issues).toEqual([
      'Nhập mã đơn của Hub để tra cứu',
    ]);
    expect((await call({ adapterType: 'HUB_STANDARD' })).issues).toHaveLength(
      1,
    );
    expect(sent).toHaveLength(0);
  });

  it('chặn địa chỉ metadata / link-local của máy chủ', async () => {
    const out = await service.call({
      ctx: ctx('http://169.254.169.254'),
      adapterType: 'HTTP_CONFIG',
      params: momo,
      kind: 'TEST',
    });
    expect(out.issues[0]).toContain('link-local');
    expect(sent).toHaveLength(0);
  });

  it('mất kết nối: trả lỗi mạng, tra cứu ra chưa rõ', async () => {
    other = () => ({
      ok: false,
      kind: 'TIMEOUT',
      message: 'Hết thời gian chờ',
      durationMs: 500,
    });
    const out = await call();
    expect(out.call?.response).toMatchObject({ ok: false, error: 'TIMEOUT' });
    expect(out.result?.outcome).toBe('UNKNOWN');
  });
});

describe('blockedDestination', () => {
  it.each([
    ['http://169.254.169.254/latest/meta-data', true],
    ['http://[fe80::1]/', true],
    ['http://[::ffff:169.254.1.1]/', true],
    ['http://metadata.google.internal/', true],
    ['ftp://ncc.test/', true],
    ['http://127.0.0.1:4030/x', false],
    ['https://10.0.0.5/api', false],
  ])('%s → chặn: %s', async (url, blocked) => {
    expect((await blockedDestination(url)) !== null).toBe(blocked);
  });
});
