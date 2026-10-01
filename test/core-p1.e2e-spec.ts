import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { AppModule } from '@/app.module';
import { ExecutionModule } from '@modules/execution/execution.module';
import { SweeperService } from '@modules/execution/application/sweeper.service';
import { PROVIDER_ADAPTERS } from '@modules/provider-adapter/domain/provider-adapter.port';
import { AnisimAdapter } from '@modules/provider-adapter/infrastructure/adapters/anisim/anisim.adapter';
import { UserService } from '@modules/user/application/user.service';
import { DRIZZLE_POOL } from '@infrastructure/database/drizzle.provider';
import { REDIS_CONNECTION } from '@infrastructure/queue/redis.provider';
import { supplierQueueName } from '@infrastructure/queue/queue-names';
import { FakeAdapter } from './support/fake-adapter';

/**
 * E2E toàn luồng P1 trên DB + Redis thật, NCC giả.
 * Chạy: DATABASE_URL=<db test> REDIS_URL=redis://localhost:6379/15 npm run test:e2e -- core-p1
 */
jest.setTimeout(90_000);

interface OrderBody {
  transCode: string;
  requestId: string;
  status: string;
  supplierCode: string;
  packageCode: string;
  error: { code: string } | null;
}

describe('Core P1 (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let fake: FakeAdapter;
  let pool: Pool;
  let adminToken: string;
  let apiKey: string;
  let merchantId: string;
  let supplierId: string;

  const run = Date.now().toString(36).toUpperCase();
  const supplierCode = `FK${run}`;
  const packageCode = 'PKG-E2E';
  let seq = 0;
  const nextPhone = () =>
    `09${run.slice(-4).replace(/\D/g, '1').padStart(4, '1')}${String(seq++).padStart(4, '0')}`;

  const admin = () => ({ Authorization: `Bearer ${adminToken}` });
  const merchant = () => ({ 'x-api-key': apiKey });

  async function createOrder(phone: string, requestId = `REQ-${run}-${seq++}`) {
    return http.post('/v1/orders').set(merchant()).send({
      requestId,
      supplierCode,
      action: 'BUY_DATA',
      packageCode,
      phone,
    });
  }

  async function adminOrder(transCode: string) {
    const res = await http.get(`/admin/orders/${transCode}`).set(admin());
    return res.body as {
      status: string;
      submitCount: number;
      checkCount: number;
    };
  }

  async function waitStatus(
    transCode: string,
    status: string,
    admin_ = false,
    timeoutMs = 30_000,
  ) {
    const deadline = Date.now() + timeoutMs;
    let last = '';
    while (Date.now() < deadline) {
      if (admin_) {
        last = (await adminOrder(transCode)).status;
      } else {
        const res = await http.get(`/v1/orders/${transCode}`).set(merchant());
        last = (res.body as OrderBody).status;
      }
      if (last === status) return;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Đơn ${transCode} không tới ${status}, đang ${last}`);
  }

  beforeAll(async () => {
    process.env.APP_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');
    fake = new FakeAdapter();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, ExecutionModule],
    })
      .overrideProvider(PROVIDER_ADAPTERS)
      .useFactory({
        factory: (anisim: AnisimAdapter) => [anisim, fake],
        inject: [AnisimAdapter],
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    http = request(app.getHttpServer());
    pool = app.get(DRIZZLE_POOL);
    await pool.query(
      "update suppliers set status = 'DISABLED' where adapter_type = 'FAKE'",
    );

    const email = `admin-${run.toLowerCase()}@e2e.local`;
    await app.get(UserService).create({
      email,
      password: 'Admin123!',
      role: 'ADMIN',
    });
    const login = await http
      .post('/auth/login')
      .send({ email, password: 'Admin123!' });
    if (login.status !== 200) {
      throw new Error(`Đăng nhập admin lỗi: ${JSON.stringify(login.body)}`);
    }
    adminToken = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Cấu hình runtime qua admin API', () => {
    it('tạo NCC mặc định PAUSED, secret không bao giờ trả ra', async () => {
      const res = await http
        .post('/admin/suppliers')
        .set(admin())
        .send({
          code: supplierCode,
          name: 'NCC giả',
          adapterType: 'FAKE',
          baseUrl: 'http://fake.local',
          pollScheduleSec: [1],
          maxResubmit: 2,
          callbackIpWhitelist: ['127.0.0.1'],
          secrets: { token: 'super-secret' },
        })
        .expect(201);

      const body = res.body as Record<string, unknown>;
      supplierId = body.id as string;
      expect(body).toMatchObject({
        status: 'PAUSED',
        hasSecrets: true,
        version: 1,
      });
      expect(JSON.stringify(body)).not.toContain('super-secret');

      const row = await pool.query<{ secrets_enc: string }>(
        'select secrets_enc from suppliers where id = $1',
        [supplierId],
      );
      expect(row.rows[0].secrets_enc.startsWith('v1.')).toBe(true);
    });

    it('adapterType không tồn tại bị từ chối', async () => {
      const res = await http
        .post('/admin/suppliers')
        .set(admin())
        .send({
          code: `X${run}`,
          name: 'x',
          adapterType: 'NOPE',
          baseUrl: 'http://x.local',
        })
        .expect(400);
      expect((res.body as { error: string }).error).toBe(
        'ERR_INVALID_SUPPLIER_CONFIG',
      );
    });

    it('tạo merchant: API key chỉ trả ra một lần', async () => {
      const created = await http
        .post('/admin/merchants')
        .set(admin())
        .send({ code: `M${run}`, name: 'Store e2e' })
        .expect(201);
      const body = created.body as {
        id: string;
        apiKey: string;
        apiKeyLast4: string;
      };
      merchantId = body.id;
      apiKey = body.apiKey;
      expect(apiKey.endsWith(body.apiKeyLast4)).toBe(true);

      const detail = await http
        .get(`/admin/merchants/${merchantId}`)
        .set(admin())
        .expect(200);
      expect(JSON.stringify(detail.body)).not.toContain(apiKey);
    });
  });

  describe('Xác thực merchant', () => {
    it('không có key 401, key sai 401, không cần JWT', async () => {
      await http.get('/v1/orders/TXNONE').expect(401);
      await http
        .get('/v1/orders/TXNONE')
        .set({ 'x-api-key': 'pk_wrong' })
        .expect(401);
      await http.get('/v1/orders/TXNONE').set(merchant()).expect(404);
    });
  });

  describe('Tiếp nhận đơn', () => {
    it('NCC đang PAUSED → 422 và không để lại đơn nào', async () => {
      const requestId = `REQ-${run}-paused`;
      const res = await createOrder(nextPhone(), requestId);
      expect(res.status).toBe(422);
      expect((res.body as { error: string }).error).toBe(
        'ERR_SUPPLIER_UNAVAILABLE',
      );
      await http
        .get('/v1/orders')
        .query({ requestId })
        .set(merchant())
        .expect(404);
    });

    it('bật NCC ACTIVE lúc runtime thì nhận đơn ngay', async () => {
      await http
        .patch(`/admin/suppliers/${supplierId}`)
        .set(admin())
        .send({ status: 'ACTIVE' })
        .expect(200);
      const phone = nextPhone();
      fake.plan(phone, ['SUCCESS']);
      const res = await createOrder(phone);
      expect(res.status).toBe(202);
      expect(res.body).toMatchObject({
        status: 'PENDING',
        supplierCode,
        packageCode,
      });
      await waitStatus((res.body as OrderBody).transCode, 'COMPLETED');
    });

    it('NCC không tồn tại → 422, action NCC không hỗ trợ → 422, SĐT sai → 400', async () => {
      const unknown = await http
        .post('/v1/orders')
        .set(merchant())
        .send({
          requestId: `R-${run}-a`,
          supplierCode: 'NOPE',
          action: 'BUY_DATA',
          packageCode,
          phone: '0914780285',
        });
      expect(unknown.status).toBe(422);
      expect((unknown.body as { error: string }).error).toBe(
        'ERR_SUPPLIER_UNAVAILABLE',
      );

      const action = await http
        .post('/v1/orders')
        .set(merchant())
        .send({
          requestId: `R-${run}-b`,
          supplierCode,
          action: 'TOPUP',
          packageCode,
          phone: '0914780285',
        });
      expect(action.status).toBe(422);
      expect((action.body as { error: string }).error).toBe(
        'ERR_ACTION_NOT_SUPPORTED',
      );

      const phone = await http
        .post('/v1/orders')
        .set(merchant())
        .send({
          requestId: `R-${run}-c`,
          supplierCode,
          action: 'BUY_DATA',
          packageCode,
          phone: '123',
        });
      expect(phone.status).toBe(400);
    });

    it('gửi lại cùng requestId → 200 cùng đơn; khác nội dung → 409', async () => {
      const phone = nextPhone();
      const requestId = `REQ-${run}-dup`;
      const first = await createOrder(phone, requestId);
      expect(first.status).toBe(202);

      const again = await createOrder(phone, requestId);
      expect(again.status).toBe(200);
      expect((again.body as OrderBody).transCode).toBe(
        (first.body as OrderBody).transCode,
      );

      const other = await createOrder(nextPhone(), requestId);
      expect(other.status).toBe(409);
      await waitStatus((first.body as OrderBody).transCode, 'COMPLETED');
    });

    it('10 request đồng thời cùng requestId → đúng 1 đơn', async () => {
      const phone = nextPhone();
      const requestId = `REQ-${run}-race`;

      const results = await Promise.all(
        Array.from({ length: 10 }, () => createOrder(phone, requestId)),
      );
      const statuses = results.map((r) => r.status).sort();
      expect(statuses.filter((s) => s === 202)).toHaveLength(1);
      expect(statuses.every((s) => s === 200 || s === 202)).toBe(true);
      expect(
        new Set(results.map((r) => (r.body as OrderBody).transCode)).size,
      ).toBe(1);

      const rows = await pool.query<{ n: number }>(
        'select count(*)::int as n from transactions where merchant_id = $1 and partner_trans_id = $2',
        [merchantId, requestId],
      );
      expect(rows.rows[0].n).toBe(1);
    });
  });

  describe('Vòng đời đơn qua worker', () => {
    it('NCC thành công ngay → COMPLETED, Store tra được theo requestId', async () => {
      const phone = nextPhone();
      fake.plan(phone, ['SUCCESS']);
      const requestId = `REQ-${run}-ok`;

      const res = await createOrder(phone, requestId);
      expect(res.status).toBe(202);
      const order = res.body as OrderBody;
      await waitStatus(order.transCode, 'COMPLETED');

      const byRequest = await http
        .get('/v1/orders')
        .query({ requestId })
        .set(merchant())
        .expect(200);
      expect(byRequest.body).toMatchObject({
        transCode: order.transCode,
        status: 'COMPLETED',
      });
      expect(fake.calls).toContain(`submit:${order.transCode}`);
    });

    it('NCC báo thất bại → FAILED kèm mã lỗi', async () => {
      const phone = nextPhone();
      fake.plan(phone, ['FAILED']);

      const order = (await createOrder(phone)).body as OrderBody;
      await waitStatus(order.transCode, 'FAILED');

      const detail = await http
        .get(`/v1/orders/${order.transCode}`)
        .set(merchant());
      expect((detail.body as OrderBody).error).toMatchObject({
        code: 'FAKE_FAILED',
      });
    });

    it('timeout → NCC không thấy đơn → gửi lại cùng mã → thành công', async () => {
      const phone = nextPhone();
      fake.plan(phone, ['UNKNOWN', 'NOT_FOUND', 'PENDING', 'SUCCESS']);

      const order = (await createOrder(phone)).body as OrderBody;
      await waitStatus(order.transCode, 'COMPLETED');

      const detail = await adminOrder(order.transCode);
      expect(detail.submitCount).toBe(2);
      expect(
        fake.calls.filter((c) => c === `submit:${order.transCode}`),
      ).toHaveLength(2);
    });

    it('callback chốt đơn; callback trùng bị bỏ qua; callback mâu thuẫn không đổi trạng thái', async () => {
      const phone = nextPhone();
      fake.plan(phone, ['PENDING']);
      const order = (await createOrder(phone)).body as OrderBody;
      await waitStatus(order.transCode, 'PROCESSING');

      const send = (eventId: string, outcome: string) =>
        http
          .post(`/v1/callbacks/${supplierCode}`)
          .send({ eventId, transCode: order.transCode, outcome });

      await send(`EV-${order.transCode}-1`, 'SUCCESS').expect(200);
      await waitStatus(order.transCode, 'COMPLETED');

      await send(`EV-${order.transCode}-1`, 'FAILED').expect(200);
      await send(`EV-${order.transCode}-2`, 'FAILED').expect(200);
      await waitStatus(order.transCode, 'COMPLETED');

      const events = await http
        .get(`/admin/orders/${order.transCode}/events`)
        .set(admin());
      const types = (events.body as { type: string }[]).map((e) => e.type);
      expect(types).toContain('CONFLICT');
      const callbacks = await pool.query<{ n: number }>(
        'select count(*)::int as n from callback_events where supplier_id = $1 and event_id like $2',
        [supplierId, `EV-${order.transCode}-%`],
      );
      expect(callbacks.rows[0].n).toBe(2);
    });

    it('callback từ IP không nằm trong whitelist → 403', async () => {
      await http
        .patch(`/admin/suppliers/${supplierId}`)
        .set(admin())
        .send({ callbackIpWhitelist: ['10.9.9.9'] })
        .expect(200);
      await http
        .post(`/v1/callbacks/${supplierCode}`)
        .send({ eventId: 'EV-X', transCode: 'TXNONE', outcome: 'SUCCESS' })
        .expect(403);
    });

    it('đổi maxResubmit lúc runtime → hết lượt gửi lại thì MANUAL_REVIEW → vận hành chốt FAILED', async () => {
      await http
        .patch(`/admin/suppliers/${supplierId}`)
        .set(admin())
        .send({ maxResubmit: 0 })
        .expect(200);
      await new Promise((r) => setTimeout(r, 300));

      const phone = nextPhone();
      fake.plan(phone, ['UNKNOWN', 'NOT_FOUND']);

      const order = (await createOrder(phone)).body as OrderBody;
      await waitStatus(order.transCode, 'MANUAL_REVIEW', true);

      const publicView = await http
        .get(`/v1/orders/${order.transCode}`)
        .set(merchant());
      expect((publicView.body as OrderBody).status).toBe('PROCESSING');

      await http
        .post(`/admin/orders/${order.transCode}/resolve`)
        .set(admin())
        .send({ outcome: 'FAILED', reason: 'Đối soát: NCC không nhận đơn' })
        .expect(200);
      await waitStatus(order.transCode, 'FAILED');
    });

    it('Redis mất job CHECK khi đơn đang chờ poll → Sweeper vớt lại và chạy tiếp', async () => {
      await http
        .patch(`/admin/suppliers/${supplierId}`)
        .set(admin())
        .send({ pollScheduleSec: [30] })
        .expect(200);
      await new Promise((r) => setTimeout(r, 300));

      const phone = nextPhone();
      fake.plan(phone, ['PENDING', 'SUCCESS']);
      const order = (await createOrder(phone)).body as OrderBody;
      await waitStatus(order.transCode, 'PROCESSING');

      const redis = app.get<Redis>(REDIS_CONNECTION);
      const queue = new Queue(supplierQueueName(supplierCode), {
        connection: redis,
      });
      const lost = await queue.getJob(`${order.transCode}-check-1`);
      expect(lost).toBeDefined();
      await lost!.remove();
      await queue.close();
      await pool.query(
        "update transactions set next_check_at = now() - interval '5 minutes' where trans_code = $1",
        [order.transCode],
      );

      const swept = await app.get(SweeperService).run();
      expect(swept.processing).toBeGreaterThanOrEqual(1);
      await waitStatus(order.transCode, 'COMPLETED');
    });

    it('admin tra cứu lại ngay: đơn đang chờ poll 30s được xử lý ngay', async () => {
      const phone = nextPhone();
      fake.plan(phone, ['PENDING', 'SUCCESS']);
      const order = (await createOrder(phone)).body as OrderBody;
      await waitStatus(order.transCode, 'PROCESSING');

      await http
        .post(`/admin/orders/${order.transCode}/check`)
        .set(admin())
        .expect(202);
      await waitStatus(order.transCode, 'COMPLETED', false, 5_000);
    });
  });
});
