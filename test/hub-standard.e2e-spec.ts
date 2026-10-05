import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import { createHmac } from 'node:crypto';
import { Pool } from 'pg';
import { AppModule } from '@/app.module';
import { ExecutionModule } from '@modules/execution/execution.module';
import { UserService } from '@modules/user/application/user.service';
import { DRIZZLE_POOL } from '@infrastructure/database/drizzle.provider';
import { createMockNcc, MockNcc } from '../tools/mock-ncc/mock-ncc';

/**
 * E2E: Hub ↔ NCC giả theo Quy chuẩn API v1, qua HTTP thật, có chữ ký hai chiều.
 * Chạy: DATABASE_URL=<db test> REDIS_URL=redis://localhost:6379/15 npm run test:e2e -- hub-standard
 */
jest.setTimeout(90_000);

interface OrderBody {
  transCode: string;
  status: string;
  delivery: Record<string, string>;
  error: { code: string; message: string } | null;
}

describe('Chuẩn Hub v1 (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let ncc: MockNcc;
  let pool: Pool;
  let adminToken: string;
  let apiKey: string;
  let supplierId: string;

  const run = Date.now().toString(36).toUpperCase();
  const supplierCode = `STD${run}`;
  const keyId = 'hub-e2e';
  const secret = 'sk_e2e_secret_value';
  const callbackSecret = 'cb_e2e_secret_value';
  let seq = 0;

  const admin = () => ({ Authorization: `Bearer ${adminToken}` });

  function order(phone: string, packageCode = 'MD7') {
    return http
      .post('/v1/orders')
      .set({ 'x-api-key': apiKey })
      .send({
        requestId: `REQ-${run}-${seq++}`,
        supplierCode,
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

  async function eventSources(transCode: string): Promise<string[]> {
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

    ncc = createMockNcc({
      keyId,
      secret,
      prefix: '/hub/v1',
      callbackUrl: `http://127.0.0.1:${hubPort}/v1/callbacks/${supplierCode}`,
      callbackSecret,
      delayMs: 1_500,
      callbackRetryDelaysMs: [300, 600],
    });
    const nccPort = await ncc.listen(0);

    pool = app.get(DRIZZLE_POOL);
    await pool.query(
      "update suppliers set status = 'DISABLED' where adapter_type in ('FAKE', 'HUB_STANDARD')",
    );

    const email = `std-${run.toLowerCase()}@e2e.local`;
    await app.get(UserService).create({
      email,
      password: 'Admin123!',
      role: 'ADMIN',
    });
    const login = await http
      .post('/auth/login')
      .send({ email, password: 'Admin123!' });
    adminToken = (login.body as { accessToken: string }).accessToken;

    const merchant = await http
      .post('/admin/merchants')
      .set(admin())
      .send({ code: `MS${run}`, name: 'Store e2e chuẩn' })
      .expect(201);
    apiKey = (merchant.body as { apiKey: string }).apiKey;

    const supplier = await http
      .post('/admin/suppliers')
      .set(admin())
      .send({
        code: supplierCode,
        name: 'NCC giả chuẩn v1',
        adapterType: 'HUB_STANDARD',
        baseUrl: `http://127.0.0.1:${nccPort}/hub/v1`,
        pollScheduleSec: [30],
        params: { keyId },
        secrets: { secret, callbackSecret },
      })
      .expect(201);
    supplierId = (supplier.body as { id: string }).id;
  });

  afterAll(async () => {
    await pool
      ?.query("update suppliers set status = 'DISABLED' where id = $1", [
        supplierId,
      ])
      .catch(() => undefined);
    await ncc?.close();
    await app?.close();
  });

  it('adapter-types mô tả Chuẩn Hub v1 cho giao diện', async () => {
    const res = await http
      .get('/admin/suppliers/adapter-types')
      .set(admin())
      .expect(200);
    const standard = (
      res.body as {
        type: string;
        params: { key: string; type?: string }[];
      }[]
    ).find((item) => item.type === 'HUB_STANDARD');
    expect(standard?.params.map((p) => p.key)).toEqual([
      'keyId',
      'checkBeforeSubmit',
    ]);
    expect(standard?.params[1].type).toBe('boolean');
  });

  it('thử kết nối: ping có chữ ký hợp lệ', async () => {
    const res = await http
      .post(`/admin/suppliers/${supplierId}/test-connection`)
      .set(admin())
      .expect(200);
    expect(res.body).toMatchObject({ ok: true });
    expect((res.body as { message: string }).message).toContain(
      'chữ ký hợp lệ',
    );
  });

  it('secret sai thì thử kết nối báo lỗi, sửa lại thì hết', async () => {
    await http
      .patch(`/admin/suppliers/${supplierId}`)
      .set(admin())
      .send({ secrets: { secret: 'sai', callbackSecret } })
      .expect(200);
    const bad = await http
      .post(`/admin/suppliers/${supplierId}/test-connection`)
      .set(admin())
      .expect(200);
    expect(bad.body).toMatchObject({ ok: false });
    expect((bad.body as { message: string }).message).toContain('UNAUTHORIZED');

    await http
      .patch(`/admin/suppliers/${supplierId}`)
      .set(admin())
      .send({ secrets: { secret, callbackSecret }, status: 'ACTIVE' })
      .expect(200);
  });

  it('0900000001: NCC thành công ngay → COMPLETED kèm delivery', async () => {
    const res = await order('0900000001').expect(202);
    const done = await waitStatus(
      (res.body as OrderBody).transCode,
      'COMPLETED',
    );
    expect(done.delivery).toMatchObject({ msisdn: '0900000001' });
  });

  it('0900000002: NCC từ chối → FAILED với mã lỗi chuẩn', async () => {
    const res = await order('0900000002').expect(202);
    const done = await waitStatus((res.body as OrderBody).transCode, 'FAILED');
    expect(done.error).toMatchObject({ code: 'SUBSCRIBER_INVALID' });
  });

  it('gói không tồn tại → FAILED PACKAGE_NOT_FOUND', async () => {
    const res = await order('0912345678', 'NOT_EXIST').expect(202);
    const done = await waitStatus((res.body as OrderBody).transCode, 'FAILED');
    expect(done.error).toMatchObject({ code: 'PACKAGE_NOT_FOUND' });
  });

  it('0900000003: PROCESSING → callback có chữ ký chốt COMPLETED (lịch poll 30 giây chưa tới)', async () => {
    const res = await order('0900000003').expect(202);
    const transCode = (res.body as OrderBody).transCode;
    await waitStatus(transCode, 'COMPLETED');
    expect(await eventSources(transCode)).toContain('CALLBACK');
  });

  it('0900000004: callback báo FAILED OUT_OF_STOCK', async () => {
    const res = await order('0900000004').expect(202);
    const done = await waitStatus((res.body as OrderBody).transCode, 'FAILED');
    expect(done.error).toMatchObject({ code: 'OUT_OF_STOCK' });
  });

  it('callback sai chữ ký hoặc không ký bị 403', async () => {
    const body = JSON.stringify({
      eventId: 'EV-FAKE',
      order: { requestId: 'TXNONE', status: 'SUCCESS' },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    await http
      .post(`/v1/callbacks/${supplierCode}`)
      .set({
        'Content-Type': 'application/json',
        'X-Supplier-Timestamp': timestamp,
        'X-Supplier-Signature': createHmac('sha256', 'sai')
          .update(`${timestamp}\n${body}`)
          .digest('hex'),
      })
      .send(body)
      .expect(403);
    await http
      .post(`/v1/callbacks/${supplierCode}`)
      .set({ 'Content-Type': 'application/json' })
      .send(body)
      .expect(403);
  });

  it('0900000005: NCC trả 500 nhưng đã tạo đơn → Hub tra cứu ra COMPLETED, không gửi trùng', async () => {
    await http
      .patch(`/admin/suppliers/${supplierId}`)
      .set(admin())
      .send({ pollScheduleSec: [1] })
      .expect(200);
    await new Promise((r) => setTimeout(r, 300));

    const res = await order('0900000005').expect(202);
    const transCode = (res.body as OrderBody).transCode;
    await waitStatus(transCode, 'COMPLETED');

    expect(ncc.orders.get(transCode)?.status).toBe('SUCCESS');
    const creates = ncc.requests.filter((r) => r === 'POST /hub/v1/orders');
    const queries = ncc.requests.filter(
      (r) => r === `GET /hub/v1/orders/${transCode}`,
    );
    expect(queries.length).toBeGreaterThanOrEqual(1);
    expect(creates.length).toBe(ncc.orders.size);
    expect(await eventSources(transCode)).toEqual(
      expect.arrayContaining(['SUBMIT', 'CHECK']),
    );
  });

  it('API 1: Store lấy danh sách gói qua Hub (dạng chuẩn, lọc theo thao tác)', async () => {
    const res = await http
      .get(`/v1/suppliers/${supplierCode}/packages`)
      .query({ action: 'BUY_DATA', phone: '0912345678' })
      .set({ 'x-api-key': apiKey })
      .expect(200);
    expect(res.body).toEqual({
      supplierCode,
      packages: [
        {
          code: 'DATA5GB',
          name: 'Data 5GB / 30 ngày',
          price: 50000,
          description: 'BUY_DATA',
        },
      ],
    });
    expect(
      ncc.requests.some((r) =>
        r.startsWith('GET /hub/v1/packages?action=BUY_DATA&msisdn=0912345678'),
      ),
    ).toBe(true);
  });

  it('API 2: Store kiểm tra gói qua Hub', async () => {
    const check = (phone: string) =>
      http
        .post('/v1/packages/check')
        .set({ 'x-api-key': apiKey })
        .send({
          supplierCode,
          action: 'BUY_DATA',
          packageCode: 'DATA5GB',
          phone,
        })
        .expect(200);
    expect((await check('0912345678')).body).toMatchObject({
      eligible: true,
      reason: null,
    });
    expect((await check('0900000006')).body).toMatchObject({
      eligible: false,
      reason: { code: 'SUBSCRIBER_NOT_ELIGIBLE' },
    });
  });

  it('bật kiểm tra trước khi gửi: gói không đăng ký được → FAILED ngay, không gửi đơn sang NCC', async () => {
    await http
      .patch(`/admin/suppliers/${supplierId}`)
      .set(admin())
      .send({ params: { keyId, checkBeforeSubmit: 'true' } })
      .expect(200);
    await new Promise((r) => setTimeout(r, 300));

    const createsBefore = ncc.requests.filter(
      (r) => r === 'POST /hub/v1/orders',
    ).length;
    const rejected = await order('0900000006', 'DATA5GB').expect(202);
    const failed = await waitStatus(
      (rejected.body as OrderBody).transCode,
      'FAILED',
    );
    expect(failed.error).toMatchObject({
      code: 'SUBSCRIBER_NOT_ELIGIBLE',
      message: 'Thuê bao không đủ điều kiện đăng ký gói',
    });
    expect(ncc.requests.filter((r) => r === 'POST /hub/v1/orders').length).toBe(
      createsBefore,
    );

    const accepted = await order('0900000001', 'DATA5GB').expect(202);
    await waitStatus((accepted.body as OrderBody).transCode, 'COMPLETED');
  });

  it('API 5: admin xem đơn phía NCC theo khoảng thời gian', async () => {
    const res = await http
      .post(`/admin/suppliers/${supplierId}/supplier-orders`)
      .set(admin())
      .send({
        from: new Date(Date.now() - 3_600_000).toISOString(),
        to: new Date(Date.now() + 60_000).toISOString(),
      })
      .expect(200);
    const body = res.body as {
      supported: boolean;
      ok: boolean;
      orders: { transCode: string; outcome: string }[];
    };
    expect(body).toMatchObject({ supported: true, ok: true });
    expect(body.orders.length).toBe(ncc.orders.size);
    expect(body.orders.map((item) => item.outcome)).toContain('SUCCESS');
  });

  it('NCC tạm dừng thì Store không lấy được gói', async () => {
    await http
      .patch(`/admin/suppliers/${supplierId}`)
      .set(admin())
      .send({ status: 'PAUSED' })
      .expect(200);
    await new Promise((r) => setTimeout(r, 300));
    const res = await http
      .get(`/v1/suppliers/${supplierCode}/packages`)
      .set({ 'x-api-key': apiKey })
      .expect(422);
    expect((res.body as { error: string }).error).toBe(
      'ERR_SUPPLIER_UNAVAILABLE',
    );
  });
});
