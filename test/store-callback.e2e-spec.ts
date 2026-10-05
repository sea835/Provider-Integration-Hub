import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { createServer, IncomingHttpHeaders, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { ExecutionModule } from '@modules/execution/execution.module';
import { StoreCallbackWorkerModule } from '@modules/store-callback/store-callback-worker.module';
import { PROVIDER_ADAPTERS } from '@modules/provider-adapter/domain/provider-adapter.port';
import { HubStandardAdapter } from '@modules/provider-adapter/infrastructure/adapters/hub-standard/hub-standard.adapter';
import { UserService } from '@modules/user/application/user.service';
import { FakeAdapter } from './support/fake-adapter';

/**
 * E2E callback kết quả đơn về Store: cấu hình, ký HMAC, gửi lại khi Store lỗi, gửi lại tay.
 * Chạy: DATABASE_URL=<db test> REDIS_URL=redis://localhost:6379/15 npm run test:e2e -- store-callback
 */
jest.setTimeout(90_000);

interface Received {
  headers: IncomingHttpHeaders;
  raw: string;
  body: {
    eventId: string;
    event: string;
    data: Record<string, unknown> | null;
  };
}

interface CallbackRow {
  id: string;
  status: string;
  attempts: number;
  event: string;
  lastHttpStatus: number | null;
  lastError: string | null;
}

describe('Callback về Store (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let fake: FakeAdapter;
  let store: Server;
  let storeUrl: string;
  let adminToken: string;
  let apiKey: string;
  let merchantId: string;
  let secret: string;
  const received: Received[] = [];
  const replies: number[] = [];

  const run = Date.now().toString(36).toUpperCase();
  const supplierCode = `CB${run}`;
  let seq = 0;
  const nextPhone = () =>
    `09${run.slice(-4).replace(/\D/g, '2').padStart(4, '2')}${String(seq++).padStart(4, '0')}`;
  const admin = () => ({ Authorization: `Bearer ${adminToken}` });

  async function createOrder(phone: string): Promise<string> {
    const res = await http
      .post('/v1/orders')
      .set({ 'x-api-key': apiKey })
      .send({
        requestId: `REQ-${run}-${seq++}`,
        supplierCode,
        action: 'BUY_DATA',
        packageCode: 'PKG-CB',
        phone,
      })
      .expect(202);
    return (res.body as { transCode: string }).transCode;
  }

  async function callbacksOf(transCode: string): Promise<CallbackRow[]> {
    const res = await http
      .get(`/admin/orders/${transCode}/callbacks`)
      .set(admin())
      .expect(200);
    return res.body as CallbackRow[];
  }

  async function waitCallback(
    transCode: string,
    match: (row: CallbackRow) => boolean,
    timeoutMs = 15_000,
  ): Promise<CallbackRow> {
    const deadline = Date.now() + timeoutMs;
    let last: CallbackRow[] = [];
    while (Date.now() < deadline) {
      last = await callbacksOf(transCode);
      const found = last.find(match);
      if (found) return found;
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(
      `Callback của ${transCode} không tới trạng thái mong đợi: ${JSON.stringify(last)}`,
    );
  }

  function verify(item: Received): boolean {
    const timestamp = String(item.headers['x-hub-timestamp']);
    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${item.raw}`)
      .digest('hex');
    return item.headers['x-hub-signature'] === `sha256=${expected}`;
  }

  beforeAll(async () => {
    process.env.APP_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');
    process.env.STORE_CALLBACK_POLL_MS = '150';
    fake = new FakeAdapter();

    store = createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString('utf8')));
      req.on('end', () => {
        received.push({
          headers: req.headers,
          raw,
          body: JSON.parse(raw) as Received['body'],
        });
        res.statusCode = replies.shift() ?? 200;
        res.end(res.statusCode < 300 ? 'OK' : 'store lỗi');
      });
    });
    await new Promise<void>((resolve) => store.listen(0, '127.0.0.1', resolve));
    storeUrl = `http://127.0.0.1:${(store.address() as AddressInfo).port}/hub/callback`;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, ExecutionModule, StoreCallbackWorkerModule],
    })
      .overrideProvider(PROVIDER_ADAPTERS)
      .useFactory({
        factory: (standard: HubStandardAdapter) => [standard, fake],
        inject: [HubStandardAdapter],
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

    const email = `cb-admin-${run.toLowerCase()}@e2e.local`;
    await app.get(UserService).create({
      email,
      password: 'Admin123!',
      role: 'ADMIN',
    });
    const login = await http
      .post('/auth/login')
      .send({ email, password: 'Admin123!' })
      .expect(200);
    adminToken = (login.body as { accessToken: string }).accessToken;

    await http
      .post('/admin/suppliers')
      .set(admin())
      .send({
        code: supplierCode,
        name: 'NCC giả callback',
        adapterType: 'FAKE',
        baseUrl: 'http://fake.local',
        pollScheduleSec: [1],
      })
      .expect(201)
      .then((res) =>
        http
          .patch(`/admin/suppliers/${(res.body as { id: string }).id}`)
          .set(admin())
          .send({ status: 'ACTIVE' })
          .expect(200),
      );

    const merchant = await http
      .post('/admin/merchants')
      .set(admin())
      .send({ code: `CB${run}`, name: 'Store callback e2e' })
      .expect(201);
    merchantId = (merchant.body as { id: string }).id;
    apiKey = (merchant.body as { apiKey: string }).apiKey;
  });

  afterAll(async () => {
    await app?.close();
    await new Promise((resolve) => store?.close(resolve));
  });

  it('chưa có địa chỉ hoặc khoá ký thì không bật được; khoá ký chỉ trả ra một lần', async () => {
    await http
      .patch(`/admin/merchants/${merchantId}`)
      .set(admin())
      .send({ callbackEnabled: true })
      .expect(422);
    await http
      .patch(`/admin/merchants/${merchantId}`)
      .set(admin())
      .send({ callbackUrl: 'not a url' })
      .expect(400);
    await http
      .patch(`/admin/merchants/${merchantId}`)
      .set(admin())
      .send({ callbackUrl: storeUrl, callbackEnabled: true })
      .expect(422);

    const rotated = await http
      .post(`/admin/merchants/${merchantId}/callback-secret`)
      .set(admin())
      .expect(201);
    secret = (rotated.body as { callbackSecret: string }).callbackSecret;
    expect(secret.startsWith('whsec_')).toBe(true);

    const enabled = await http
      .patch(`/admin/merchants/${merchantId}`)
      .set(admin())
      .send({ callbackUrl: storeUrl, callbackEnabled: true })
      .expect(200);
    expect(enabled.body).toMatchObject({
      callbackUrl: storeUrl,
      callbackEnabled: true,
      hasCallbackSecret: true,
      callbackSecretLast4: secret.slice(-4),
    });
    expect(JSON.stringify(enabled.body)).not.toContain(secret);
  });

  it('gửi thử: Store nhận ping có chữ ký đúng', async () => {
    const res = await http
      .post(`/admin/merchants/${merchantId}/callback-test`)
      .set(admin())
      .expect(200);
    expect(res.body).toMatchObject({ ok: true, httpStatus: 200 });
    const ping = received.at(-1)!;
    expect(ping.body.event).toBe('ping');
    expect(ping.headers['x-hub-event-id']).toBe(ping.body.eventId);
    expect(verify(ping)).toBe(true);
  });

  it('đơn chốt thành công → Store nhận order.completed có ký, kèm dữ liệu đơn', async () => {
    const phone = nextPhone();
    fake.plan(phone, ['SUCCESS']);
    const transCode = await createOrder(phone);

    const row = await waitCallback(transCode, (r) => r.status === 'DELIVERED');
    expect(row).toMatchObject({
      event: 'order.completed',
      attempts: 1,
      lastHttpStatus: 200,
    });
    const item = received.find((r) => r.body.eventId === row.id)!;
    expect(verify(item)).toBe(true);
    expect(item.headers['x-hub-event']).toBe('order.completed');
    expect(item.body.data).toMatchObject({ transCode, status: 'COMPLETED' });
  });

  it('Store lỗi → Hub hẹn gửi lại; vận hành bấm gửi lại thì Store nhận được', async () => {
    replies.push(500);
    const phone = nextPhone();
    fake.plan(phone, ['FAILED']);
    const transCode = await createOrder(phone);

    const failed = await waitCallback(
      transCode,
      (r) => r.attempts === 1 && r.status === 'PENDING',
    );
    expect(failed).toMatchObject({
      event: 'order.failed',
      lastHttpStatus: 500,
    });
    expect(failed.lastError).toContain('HTTP 500');

    await http
      .post(`/admin/store-callbacks/${failed.id}/retry`)
      .set(admin())
      .expect(200);
    const delivered = await waitCallback(
      transCode,
      (r) => r.status === 'DELIVERED',
    );
    expect(delivered.attempts).toBe(2);
    const deliveries = received.filter((r) => r.body.eventId === failed.id);
    expect(deliveries).toHaveLength(2);
    expect(deliveries.every(verify)).toBe(true);
  });

  it('Store tắt callback → bỏ qua (SKIPPED), không gửi', async () => {
    await http
      .patch(`/admin/merchants/${merchantId}`)
      .set(admin())
      .send({ callbackEnabled: false })
      .expect(200);
    const before = received.length;
    const phone = nextPhone();
    fake.plan(phone, ['SUCCESS']);
    const transCode = await createOrder(phone);

    await waitCallback(transCode, (r) => r.status === 'SKIPPED');
    expect(received).toHaveLength(before);

    const list = await http
      .get(`/admin/merchants/${merchantId}/callbacks`)
      .set(admin())
      .expect(200);
    expect((list.body as CallbackRow[]).length).toBeGreaterThanOrEqual(3);
  });

  it('địa chỉ metadata của máy chủ bị chặn', async () => {
    await http
      .patch(`/admin/merchants/${merchantId}`)
      .set(admin())
      .send({ callbackUrl: 'http://169.254.169.254/latest' })
      .expect(200);
    const res = await http
      .post(`/admin/merchants/${merchantId}/callback-test`)
      .set(admin())
      .expect(200);
    expect(res.body).toMatchObject({ ok: false, httpStatus: null });
    expect((res.body as { error: string }).error).toContain('nội bộ');
  });
});
