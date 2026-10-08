import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { Pool } from 'pg';
import { AppModule } from '@/app.module';
import { ExecutionModule } from '@modules/execution/execution.module';
import { UserService } from '@modules/user/application/user.service';
import { DRIZZLE_POOL } from '@infrastructure/database/drizzle.provider';
import { createMockAni, MockAni } from '../tools/mock-ani/mock-ani';

/**
 * E2E: tích hợp ANI SIM hoàn toàn bằng cấu hình (loại Tự cấu hình), không có code riêng cho ANI.
 * Chạy: DATABASE_URL=<db test> REDIS_URL=redis://localhost:6379/15 npm run test:e2e -- http-config
 */
jest.setTimeout(90_000);

interface OrderBody {
  transCode: string;
  status: string;
  delivery: Record<string, string>;
  error: { code: string; message: string } | null;
}

const anisim = JSON.parse(
  readFileSync(join(__dirname, '../tools/integrations/anisim.json'), 'utf8'),
) as { spec: { actions: string[] } } & Record<string, unknown>;

describe('Tự cấu hình: tích hợp ANI SIM trên giao diện (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let ani: MockAni;
  let pool: Pool;
  let adminToken: string;
  let apiKey: string;
  let supplierId: string;
  let aniPort: number;

  const run = Date.now().toString(36).toUpperCase();
  const supplierCode = `ANI${run}`;
  const aniKey = 'ANI_E2E_KEY_123';
  let seq = 0;

  const admin = () => ({ Authorization: `Bearer ${adminToken}` });

  function activate(serial: string | null, packageCode = 'plan-esim-5gb') {
    return http
      .post('/v1/orders')
      .set({ 'x-api-key': apiKey })
      .send({
        requestId: `REQ-${run}-${seq++}`,
        supplierCode,
        action: 'ACTIVATE_SIM',
        packageCode,
        ...(serial ? { serial } : {}),
      });
  }

  async function waitStatus(transCode: string, status: string) {
    const deadline = Date.now() + 30_000;
    let last: OrderBody | undefined;
    while (Date.now() < deadline) {
      const res = await http
        .get(`/v1/orders/${transCode}`)
        .set({ 'x-api-key': apiKey });
      last = res.body as OrderBody;
      if (last.status === status) return last;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(
      `Đơn ${transCode} không tới ${status}: ${JSON.stringify(last)}`,
    );
  }

  async function resultSources(transCode: string): Promise<string[]> {
    const res = await http
      .get(`/admin/orders/${transCode}/events`)
      .set(admin());
    return (res.body as { source: string; type: string }[])
      .filter((e) => e.type === 'RESULT')
      .map((e) => e.source);
  }

  beforeAll(async () => {
    process.env.APP_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, ExecutionModule],
    }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    const hubPort = (
      (app.getHttpServer() as unknown as Server).address() as AddressInfo
    ).port;
    http = request(app.getHttpServer());

    ani = createMockAni({
      apiKey: aniKey,
      callbackUrl: `http://127.0.0.1:${hubPort}/v1/callbacks/${supplierCode}`,
      delayMs: 1_500,
      callbackRetryDelaysMs: [300, 600],
    });
    aniPort = await ani.listen(0);

    pool = app.get(DRIZZLE_POOL);
    await pool.query(
      "update suppliers set status = 'DISABLED' where adapter_type in ('FAKE', 'HUB_STANDARD', 'HTTP_CONFIG')",
    );

    const email = `cfg-${run.toLowerCase()}@e2e.local`;
    await app
      .get(UserService)
      .create({ email, password: 'Admin123!', role: 'ADMIN' });
    const login = await http
      .post('/auth/login')
      .send({ email, password: 'Admin123!' });
    adminToken = (login.body as { accessToken: string }).accessToken;

    const merchant = await http
      .post('/admin/merchants')
      .set(admin())
      .send({ code: `MC${run}`, name: 'Store e2e tự cấu hình' })
      .expect(201);
    apiKey = (merchant.body as { apiKey: string }).apiKey;
  });

  afterAll(async () => {
    await pool
      ?.query("update suppliers set status = 'DISABLED' where id = $1", [
        supplierId,
      ])
      .catch(() => undefined);
    await ani?.close();
    await app?.close();
  });

  it('adapter-types có loại Tự cấu hình kèm bản tích hợp trống', async () => {
    const res = await http
      .get('/admin/suppliers/adapter-types')
      .set(admin())
      .expect(200);
    const config = (
      res.body as { type: string; editor: string; defaultParams?: unknown }[]
    ).find((item) => item.type === 'HTTP_CONFIG');
    expect(config).toMatchObject({ editor: 'HTTP_CONFIG' });
    expect(config?.defaultParams).toBeDefined();
  });

  it('phân loại thử: không gọi ANI, che bí mật, đọc đúng mã từ chối', async () => {
    const res = await http
      .post('/admin/suppliers/integration-preview')
      .set(admin())
      .send({
        baseUrl: 'https://ap1.anipay.vn',
        params: anisim,
        kind: 'SUBMIT',
        order: {
          action: 'ACTIVATE_SIM',
          packageCode: 'plan-sim-10gb',
          serial: '8984000000000002',
        },
        response: {
          httpStatus: 400,
          body: { code: 4001, message: 'Serial is not available' },
        },
      })
      .expect(200);
    expect(res.body).toMatchObject({
      issues: [],
      warnings: [],
      request: {
        method: 'POST',
        url: 'https://ap1.anipay.vn/api/v1/agency/orders',
        headers: { 'X-API-Key': '***apiKey***' },
        body: { packagePlanId: 'plan-sim-10gb', serial: '8984000000000002' },
      },
      result: {
        outcome: 'FAILED',
        errorCode: 'ANI_4001',
        errorMessage: 'Serial is not available',
      },
    });
    expect(ani.requests).toHaveLength(0);
  });

  it('bản tích hợp sai cấu trúc thì không lưu được', async () => {
    const res = await http
      .post('/admin/suppliers')
      .set(admin())
      .send({
        code: `BAD${run}`,
        name: 'sai',
        adapterType: 'HTTP_CONFIG',
        baseUrl: 'https://x.vn',
        params: { spec: { auth: { type: 'OAUTH' } } },
      })
      .expect(400);
    expect((res.body as { error: string }).error).toBe(
      'ERR_INVALID_SUPPLIER_CONFIG',
    );
  });

  it('tạo NCC ANI bằng cấu hình, thử kết nối, bật', async () => {
    const created = await http
      .post('/admin/suppliers')
      .set(admin())
      .send({
        code: supplierCode,
        name: 'ANI SIM (tự cấu hình)',
        adapterType: 'HTTP_CONFIG',
        baseUrl: `http://127.0.0.1:${aniPort}`,
        pollScheduleSec: [30],
        callbackIpWhitelist: ['127.0.0.1'],
        params: anisim,
        secrets: { apiKey: aniKey },
      })
      .expect(201);
    supplierId = (created.body as { id: string }).id;
    expect(JSON.stringify(created.body)).not.toContain(aniKey);

    const test = await http
      .post(`/admin/suppliers/${supplierId}/test-connection`)
      .set(admin())
      .expect(200);
    expect(test.body).toMatchObject({ ok: true });

    await http
      .patch(`/admin/suppliers/${supplierId}`)
      .set(admin())
      .send({ status: 'ACTIVE' })
      .expect(200);
  });

  it('thao tác ANI không hỗ trợ (mua data) bị từ chối ngay ở API', async () => {
    const res = await http
      .post('/v1/orders')
      .set({ 'x-api-key': apiKey })
      .send({
        requestId: `REQ-${run}-data`,
        supplierCode,
        action: 'BUY_DATA',
        packageCode: 'x',
        phone: '0912345678',
      });
    expect(res.status).toBe(422);
    expect((res.body as { error: string }).error).toBe(
      'ERR_ACTION_NOT_SUPPORTED',
    );
  });

  it('eSIM: đang xử lý → callback chốt thành công, có LPA và QR', async () => {
    const res = await activate(null).expect(202);
    const transCode = (res.body as OrderBody).transCode;
    const done = await waitStatus(transCode, 'COMPLETED');
    expect(done.delivery).toMatchObject({
      lpa: expect.stringContaining('LPA:1$') as string,
    });
    expect(await resultSources(transCode)).toContain('CALLBACK');
    expect(
      JSON.stringify(
        (await http.get(`/admin/orders/${transCode}/events`).set(admin())).body,
      ),
    ).not.toContain(aniKey);
  });

  it('serial ...0002: ANI từ chối ngay → FAILED ANI_4001', async () => {
    const res = await activate('8984000000000002').expect(202);
    const done = await waitStatus((res.body as OrderBody).transCode, 'FAILED');
    expect(done.error).toMatchObject({
      code: 'ANI_4001',
      message: 'Serial is not available',
    });
  });

  it('gói không tồn tại → FAILED ANI_4000', async () => {
    const res = await activate('8984000000000001', 'NOT_EXIST').expect(202);
    const done = await waitStatus((res.body as OrderBody).transCode, 'FAILED');
    expect(done.error?.code).toBe('ANI_4000');
  });

  it('serial ...0005: callback báo status 5 → FAILED ANI_4012', async () => {
    const res = await activate('8984000000000005').expect(202);
    const done = await waitStatus((res.body as OrderBody).transCode, 'FAILED');
    expect(done.error?.code).toBe('ANI_4012');
  });

  it('serial ...0009: ANI không gửi callback → Hub tự tra cứu (khớp đúng requestId) ra thành công', async () => {
    await http
      .patch(`/admin/suppliers/${supplierId}`)
      .set(admin())
      .send({ pollScheduleSec: [1] })
      .expect(200);
    await new Promise((r) => setTimeout(r, 300));

    const res = await activate('8984000000000009').expect(202);
    const transCode = (res.body as OrderBody).transCode;
    await waitStatus(transCode, 'COMPLETED');
    expect(await resultSources(transCode)).toEqual(
      expect.arrayContaining(['SUBMIT', 'CHECK']),
    );
    expect(
      ani.requests.some((r) =>
        r.startsWith(`GET /api/v1/agency/orders?keyword=${transCode}`),
      ),
    ).toBe(true);
  });

  it('API 1 của ANI qua Hub: danh sách gói đọc theo cấu hình', async () => {
    const res = await http
      .get(`/v1/suppliers/${supplierCode}/packages`)
      .set({ 'x-api-key': apiKey })
      .expect(200);
    expect(
      (res.body as { packages: { code: string; price: number }[] }).packages,
    ).toEqual([
      expect.objectContaining({ code: 'plan-esim-5gb', price: 95000 }),
      expect.objectContaining({ code: 'plan-sim-10gb', price: 120000 }),
    ]);
  });

  it('danh sách gói theo provider: có provider thì lọc theo provider, không có thì theo SĐT; giá trị lạ → 400', async () => {
    const spec = anisim.spec as unknown as {
      packages: { request: { query: Record<string, unknown>[] } };
    };
    await http
      .patch(`/admin/suppliers/${supplierId}`)
      .set(admin())
      .send({
        params: {
          ...anisim,
          spec: {
            ...(anisim.spec as Record<string, unknown>),
            extraFields: [
              {
                key: 'provider',
                label: 'Nhà mạng',
                type: 'TEXT',
                options: ['viettel', 'vinaphone'],
              },
            ],
            packages: {
              ...spec.packages,
              request: {
                ...spec.packages.request,
                query: [
                  ...spec.packages.request.query,
                  {
                    name: 'msisdn',
                    value: '{{order.phone}}',
                    omitIfEmpty: true,
                  },
                  {
                    name: 'provider',
                    value: '{{order.extra.provider}}',
                    omitIfEmpty: true,
                  },
                ],
              },
            },
          },
        },
      })
      .expect(200);
    await new Promise((r) => setTimeout(r, 300));

    const list = (query: string) =>
      http
        .get(`/v1/suppliers/${supplierCode}/packages?${query}`)
        .set({ 'x-api-key': apiKey });
    const lastPlans = () =>
      ani.requests.filter((line) => line.includes('/package-plans')).at(-1);

    await list('provider=viettel').expect(200);
    expect(lastPlans()).toBe(
      'GET /api/v1/agency/package-plans?page=0&limit=100&provider=viettel',
    );
    await list('phone=84912345678').expect(200);
    expect(lastPlans()).toBe(
      'GET /api/v1/agency/package-plans?page=0&limit=100&msisdn=0912345678',
    );

    expect((await list('provider=mobifone').expect(400)).body).toMatchObject({
      message:
        'extra.provider chỉ nhận: viettel, vinaphone (đang là "mobifone")',
    });
    expect((await list('nhamang=viettel').expect(400)).body).toMatchObject({
      message: expect.stringContaining('extra.nhamang') as string,
    });

    await http
      .patch(`/admin/suppliers/${supplierId}`)
      .set(admin())
      .send({ params: anisim })
      .expect(200);
    await new Promise((r) => setTimeout(r, 300));
  });

  it('ANI không có API kiểm tra gói → 422 không hỗ trợ', async () => {
    const res = await http
      .post('/v1/packages/check')
      .set({ 'x-api-key': apiKey })
      .send({
        supplierCode,
        action: 'ACTIVATE_SIM',
        packageCode: 'plan-esim-5gb',
      })
      .expect(422);
    expect((res.body as { error: string }).error).toBe(
      'ERR_FEATURE_NOT_SUPPORTED',
    );
  });

  it('API 5 của ANI: admin xem đơn phía ANI', async () => {
    const res = await http
      .post(`/admin/suppliers/${supplierId}/supplier-orders`)
      .set(admin())
      .send({})
      .expect(200);
    const body = res.body as {
      ok: boolean;
      orders: { transCode: string }[];
    };
    expect(body.ok).toBe(true);
    expect(body.orders.length).toBe(ani.orders.size);
  });

  it('luật trường tùy biến: bắt buộc serial cho Kích hoạt SIM thì đơn thiếu serial bị từ chối ngay', async () => {
    await http
      .patch(`/admin/suppliers/${supplierId}`)
      .set(admin())
      .send({
        params: {
          ...anisim,
          spec: {
            ...(anisim.spec as Record<string, unknown>),
            fields: { ACTIVATE_SIM: { phone: 'OPTIONAL', serial: 'REQUIRED' } },
          },
        },
      })
      .expect(200);
    await new Promise((r) => setTimeout(r, 300));

    const res = await activate(null).expect(400);
    expect(res.body).toMatchObject({
      error: 'ERR_VALIDATION',
      message: 'Thao tác ACTIVATE_SIM bắt buộc có serial',
    });
    await activate('8984000000000001').expect(202);
  });

  it('trường thêm (extra): NCC khai báo ngày kích hoạt + ICCID → Hub kiểm tra rồi gửi đúng kiểu', async () => {
    const spec = anisim.spec as unknown as {
      submit: { request: { body: Record<string, unknown>[] } };
    };
    await http
      .patch(`/admin/suppliers/${supplierId}`)
      .set(admin())
      .send({
        params: {
          ...anisim,
          spec: {
            ...(anisim.spec as Record<string, unknown>),
            extraFields: [
              {
                key: 'activationDate',
                label: 'Ngày kích hoạt',
                type: 'DATE',
                required: true,
                actions: ['ACTIVATE_SIM'],
              },
              { key: 'iccids', label: 'ICCID', type: 'TEXT_LIST' },
            ],
            submit: {
              ...spec.submit,
              request: {
                ...spec.submit.request,
                body: [
                  ...spec.submit.request.body,
                  {
                    key: 'activationDate',
                    value: '{{order.extra.activationDate}}',
                    type: 'string',
                  },
                  {
                    key: 'iccids',
                    value: '{{order.extra.iccids}}',
                    type: 'array',
                    omitIfEmpty: true,
                  },
                ],
              },
            },
          },
        },
      })
      .expect(200);
    await new Promise((r) => setTimeout(r, 300));

    const send = (extra: Record<string, unknown> | undefined) =>
      http
        .post('/v1/orders')
        .set({ 'x-api-key': apiKey })
        .send({
          requestId: `REQ-${run}-${seq++}`,
          supplierCode,
          action: 'ACTIVATE_SIM',
          packageCode: 'plan-esim-5gb',
          ...(extra ? { extra } : {}),
        });

    expect((await send(undefined).expect(400)).body).toMatchObject({
      message:
        'Thao tác ACTIVATE_SIM bắt buộc có extra.activationDate (Ngày kích hoạt)',
    });
    expect(
      (await send({ activationDate: '15/10/2026' }).expect(400)).body,
    ).toMatchObject({
      message: expect.stringContaining('YYYY-MM-DD') as string,
    });
    expect(
      (await send({ activationDate: '2026-10-15', passport: 'X' }).expect(400))
        .body,
    ).toMatchObject({
      message: expect.stringContaining('extra.passport') as string,
    });

    const created = await send({
      activationDate: '2026-10-15',
      iccids: ['8988001'],
    }).expect(202);
    const order = created.body as OrderBody & { extra: unknown };
    expect(order.extra).toEqual({
      activationDate: '2026-10-15',
      iccids: ['8988001'],
    });

    const deadline = Date.now() + 15_000;
    let sent: Record<string, unknown> | undefined;
    while (!sent && Date.now() < deadline) {
      const events = (
        await http.get(`/admin/orders/${order.transCode}/events`).set(admin())
      ).body as {
        source: string;
        type: string;
        request: { body?: Record<string, unknown> } | null;
      }[];
      sent = events.find((e) => e.source === 'SUBMIT' && e.type === 'RESULT')
        ?.request?.body;
      if (!sent) await new Promise((r) => setTimeout(r, 200));
    }
    expect(sent).toMatchObject({
      requestId: order.transCode,
      activationDate: '2026-10-15',
      iccids: ['8988001'],
    });
  });
});
