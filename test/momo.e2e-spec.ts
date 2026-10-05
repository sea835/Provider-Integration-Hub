import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { AppModule } from '@/app.module';
import { ExecutionModule } from '@modules/execution/execution.module';
import { UserService } from '@modules/user/application/user.service';
import { DRIZZLE_POOL } from '@infrastructure/database/drizzle.provider';
import { createMockMomo, MockMomo } from '../tools/mock-momo/mock-momo';

/**
 * E2E: tích hợp MoMo TELCO B2B chỉ bằng cấu hình (đăng nhập lấy token, ký body, requestId UUID),
 * không có code riêng cho MoMo. MoMo không có callback nên Hub tự tra cứu.
 * Chạy: DATABASE_URL=<db test> REDIS_URL=redis://localhost:6379/15 npm run test:e2e -- momo
 */
jest.setTimeout(90_000);

interface PreviewBody {
  request: { headers: Record<string, string>; signature: string | null };
}

interface OrderBody {
  transCode: string;
  status: string;
  delivery: Record<string, string>;
  error: { code: string; message: string } | null;
}

const PASSWORD = 'pq_e2e_pass_9';
const SECRET_KEY = 'momo_e2e_sk_31f';

const momo = JSON.parse(
  readFileSync(join(__dirname, '../tools/integrations/momo.json'), 'utf8'),
) as { vars: Record<string, string>; spec: unknown } & Record<string, unknown>;

describe('Tự cấu hình: tích hợp MoMo có đăng nhập và chữ ký (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let mock: MockMomo;
  let pool: Pool;
  let adminToken: string;
  let apiKey: string;
  let momoPort: number;
  const supplierIds: string[] = [];

  const run = Date.now().toString(36).toUpperCase();
  const supplierCode = `MOMO${run}`;
  let seq = 0;

  const admin = () => ({ Authorization: `Bearer ${adminToken}` });

  function buy(phone: string, code = supplierCode, packageCode = '1N_TMDT') {
    return http
      .post('/v1/orders')
      .set({ 'x-api-key': apiKey })
      .send({
        requestId: `REQ-${run}-${seq++}`,
        supplierCode: code,
        action: 'BUY_DATA',
        packageCode,
        phone,
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

  async function createSupplier(code: string, secretKey: string) {
    const created = await http
      .post('/admin/suppliers')
      .set(admin())
      .send({
        code,
        name: 'MoMo TELCO (tự cấu hình)',
        adapterType: 'HTTP_CONFIG',
        baseUrl: `http://127.0.0.1:${momoPort}`,
        pollScheduleSec: [1],
        params: { ...momo, vars: { ...momo.vars, partnerCode: 'PQ_E2E' } },
        secrets: { password: PASSWORD, secretKey },
      })
      .expect(201);
    const id = (created.body as { id: string }).id;
    supplierIds.push(id);
    expect(JSON.stringify(created.body)).not.toContain(PASSWORD);
    expect(JSON.stringify(created.body)).not.toContain(secretKey);
    return id;
  }

  async function activate(id: string) {
    await http
      .patch(`/admin/suppliers/${id}`)
      .set(admin())
      .send({ status: 'ACTIVE' })
      .expect(200);
    await new Promise((r) => setTimeout(r, 300));
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
    http = request(app.getHttpServer());

    mock = createMockMomo({
      partnerCode: 'PQ_E2E',
      username: momo.vars.username,
      password: PASSWORD,
      secretKey: SECRET_KEY,
      tokenTtlMs: 600_000,
      delayMs: 1_500,
    });
    momoPort = await mock.listen(0);

    pool = app.get(DRIZZLE_POOL);
    await pool.query(
      "update suppliers set status = 'DISABLED' where adapter_type in ('FAKE', 'HUB_STANDARD', 'HTTP_CONFIG')",
    );

    const email = `momo-${run.toLowerCase()}@e2e.local`;
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
      .send({ code: `MM${run}`, name: 'Store e2e MoMo' })
      .expect(201);
    apiKey = (merchant.body as { apiKey: string }).apiKey;
  });

  afterAll(async () => {
    if (supplierIds.length > 0) {
      await pool
        ?.query(
          "update suppliers set status = 'DISABLED' where id = any($1::uuid[])",
          [supplierIds],
        )
        .catch(() => undefined);
    }
    await mock?.close();
    await app?.close();
  });

  it('xem trước đăng nhập và gửi đơn: che bí mật, có chữ ký, partnerTransId là mã đơn Hub', async () => {
    const preview = (kind: string, response?: unknown) =>
      http
        .post('/admin/suppliers/integration-preview')
        .set(admin())
        .send({
          baseUrl: 'https://uat.momo.test',
          params: momo,
          kind,
          order: {
            transCode: 'PQTX1',
            packageCode: 'V90C',
            phone: '0912345678',
          },
          ...(response ? { response } : {}),
        })
        .expect(200);

    const login = await preview('LOGIN', {
      httpStatus: 200,
      body: { error: 866000000, message: 'Success', accessToken: 'eyJabc' },
    });
    expect(login.body).toMatchObject({
      issues: [],
      warnings: [],
      request: {
        url: 'https://uat.momo.test/telco/partner/login',
        body: { password: '***password***' },
      },
      result: { outcome: 'OK' },
    });
    expect((login.body as PreviewBody).request.headers).not.toHaveProperty(
      'Authorization',
    );

    const submit = await preview('SUBMIT', {
      httpStatus: 200,
      body: { error: 862500001, message: 'Product not active', data: null },
    });
    expect(submit.body).toMatchObject({
      request: {
        headers: { Authorization: 'Bearer ***token***' },
        body: { partnerTransId: 'PQTX1', productId: 'V90C' },
      },
      result: { outcome: 'FAILED', errorCode: 'MOMO_862500001' },
    });
    expect((submit.body as PreviewBody).request.signature).toMatch(
      /^[0-9a-f]{64}$/,
    );
    expect(mock.requests).toHaveLength(0);
  });

  it('tạo NCC MoMo, thử kết nối (đăng nhập + số dư), bật', async () => {
    const id = await createSupplier(supplierCode, SECRET_KEY);
    const test = await http
      .post(`/admin/suppliers/${id}/test-connection`)
      .set(admin())
      .expect(200);
    expect(test.body).toMatchObject({
      ok: true,
      message: expect.stringContaining('Đăng nhập được') as string,
    });
    await activate(id);
  });

  it('mua data: MoMo nhận đơn → Hub tra cứu → thành công, lưu momoTransId', async () => {
    const res = await buy('0912345678').expect(202);
    const transCode = (res.body as OrderBody).transCode;
    const done = await waitStatus(transCode, 'COMPLETED');
    expect(done.delivery).toMatchObject({ msisdn: '0912345678' });
    const order = mock.orders.get(transCode);
    expect(order).toMatchObject({ partnerTransId: transCode });
    expect(
      mock.requests.some((r) =>
        r.includes(`momoTransId=${order?.momoTransId}`),
      ),
    ).toBe(true);
  });

  it('gọi thử (GET) tra cứu đơn vừa xong và kiểm tra kết nối: gọi thật, không gửi đơn, che bí mật', async () => {
    const [transCode] = [...mock.orders.keys()];
    const id = supplierIds[0];
    const creates = () =>
      mock.requests.filter((r) => r.startsWith('POST /telco/v1/orders/create'))
        .length;
    const before = creates();
    const params = { ...momo, vars: { ...momo.vars, partnerCode: 'PQ_E2E' } };

    const query = await http
      .post(`/admin/suppliers/${id}/integration-call`)
      .set(admin())
      .send({ params, kind: 'QUERY', order: { transCode } })
      .expect(200);
    expect(query.body).toMatchObject({
      issues: [],
      login: { ok: true },
      call: { response: { ok: true, httpStatus: 200 } },
      result: { outcome: 'SUCCESS' },
    });
    const text = JSON.stringify(query.body);
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain(SECRET_KEY);

    const test = await http
      .post(`/admin/suppliers/${id}/integration-call`)
      .set(admin())
      .send({ params, kind: 'TEST' })
      .expect(200);
    expect(test.body).toMatchObject({
      result: { outcome: 'OK' },
      call: { response: { body: { data: { currency: 'VND' } } } },
    });
    expect(creates()).toBe(before);

    const submitAsGet = await http
      .post(`/admin/suppliers/${id}/integration-call`)
      .set(admin())
      .send({
        params: {
          ...params,
          spec: {
            ...(momo.spec as Record<string, unknown>),
            test: {
              request: {
                method: 'POST',
                path: '/telco/v1/orders/create',
                bodyType: 'JSON',
              },
            },
          },
        },
        kind: 'TEST',
      })
      .expect(200);
    expect((submitAsGet.body as { issues: string[] }).issues[0]).toContain(
      'Chỉ gọi thử được request GET',
    );
    expect(creates()).toBe(before);
  });

  it('thuê bao ...0002: MoMo từ chối ngay → FAILED MOMO_862500005', async () => {
    const res = await buy('0912340002').expect(202);
    const done = await waitStatus((res.body as OrderBody).transCode, 'FAILED');
    expect(done.error?.code).toBe('MOMO_862500005');
  });

  it('sản phẩm ngưng bán → FAILED MOMO_862500001', async () => {
    const res = await buy('0912345678', supplierCode, 'PRODUCT_INACTIVE_TEST');
    const done = await waitStatus((res.body as OrderBody).transCode, 'FAILED');
    expect(done.error?.code).toBe('MOMO_862500001');
  });

  it('thuê bao ...0005: tra cứu báo FAILED → FAILED MOMO_ORDER_FAILED', async () => {
    const res = await buy('0912340005').expect(202);
    const done = await waitStatus((res.body as OrderBody).transCode, 'FAILED');
    expect(done.error?.code).toBe('MOMO_ORDER_FAILED');
  });

  it('thuê bao ...0008: MoMo nhận đơn nhưng trả 504 → Hub tra cứu ra thành công, không gửi trùng', async () => {
    const creates = () =>
      mock.requests.filter((r) => r.startsWith('POST /telco/v1/orders/create'))
        .length;
    const before = creates();
    const res = await buy('0912340008').expect(202);
    const transCode = (res.body as OrderBody).transCode;
    await waitStatus(transCode, 'COMPLETED');
    expect(creates() - before).toBe(1);
  });

  it('token hết hạn giữa chừng: Hub tự đăng nhập lại và gửi lại, đơn vẫn thành công', async () => {
    const before = mock.logins;
    mock.expireTokens();
    const res = await buy('0912345679').expect(202);
    await waitStatus((res.body as OrderBody).transCode, 'COMPLETED');
    expect(mock.logins).toBe(before + 1);
  });

  it('sai khoá ký: MoMo báo chữ ký sai → FAILED vì cấu hình, không lộ bí mật trong lịch sử đơn', async () => {
    const code = `MOMOBAD${run}`;
    const id = await createSupplier(code, 'wrong_secret_key');
    await activate(id);
    const res = await buy('0912345670', code).expect(202);
    const transCode = (res.body as OrderBody).transCode;
    const done = await waitStatus(transCode, 'FAILED');
    expect(done.error?.code).toBe('SUPPLIER_CONFIG');
    const events = JSON.stringify(
      (await http.get(`/admin/orders/${transCode}/events`).set(admin())).body,
    );
    expect(events).not.toContain('wrong_secret_key');
    expect(events).not.toContain(PASSWORD);
    expect(events).toContain('Signature Invalid');
  });
});
