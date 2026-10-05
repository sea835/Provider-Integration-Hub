import { HubStandardAdapter } from '@modules/provider-adapter/infrastructure/adapters/hub-standard/hub-standard.adapter';
import { signCallback } from '@modules/provider-adapter/infrastructure/adapters/hub-standard/hub-standard.signature';
import {
  HttpJsonClient,
  HttpRequest,
} from '@modules/provider-adapter/infrastructure/http/http-json.client';
import { SupplierContext } from '@modules/provider-adapter/domain/provider-adapter.port';
import { InvalidCallbackPayloadError } from '@modules/provider-adapter/domain/adapter.errors';

const ctx: SupplierContext = {
  supplierId: 's1',
  supplierCode: 'NCCSTD',
  baseUrl: 'https://api.ncc.vn/hub/v1',
  secrets: { secret: 'sk_sandbox_9f2c4e7a', callbackSecret: 'cb_secret' },
  params: { keyId: 'hub-sandbox' },
  timeouts: { submitMs: 1000, queryMs: 500 },
  configVersion: 1,
};

describe('HubStandardAdapter', () => {
  let sent: HttpRequest[];
  let adapter: HubStandardAdapter;

  beforeEach(() => {
    sent = [];
    const http = {
      request: jest.fn((req: HttpRequest) => {
        sent.push(req);
        return Promise.resolve({
          ok: true,
          status: 200,
          body: {
            code: 'OK',
            data: { requestId: 'TX1', orderId: 'N1', status: 'PROCESSING' },
          },
          rawText: '',
          durationMs: 3,
        });
      }),
    };
    adapter = new HubStandardAdapter(http as unknown as HttpJsonClient);
  });

  it('gửi đơn kèm header ký trên đúng chuỗi body đã gửi', async () => {
    const result = await adapter.submit(ctx, {
      transCode: 'TX1',
      action: 'BUY_DATA',
      packageCode: 'MD7',
      phone: '0900000001',
      serial: null,
    });

    expect(result.outcome).toBe('PENDING');
    const req = sent[0];
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.ncc.vn/hub/v1/orders');
    expect(req.timeoutMs).toBe(1000);
    expect(JSON.parse(req.rawBody!)).toEqual({
      requestId: 'TX1',
      action: 'BUY_DATA',
      packageCode: 'MD7',
      msisdn: '0900000001',
      serial: null,
    });
    expect(req.headers?.['X-Hub-Key-Id']).toBe('hub-sandbox');
    expect(req.headers?.['X-Hub-Signature']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('tra cứu bằng GET, không có body', async () => {
    await adapter.query(ctx, { transCode: 'TX1', supplierTransId: null });
    expect(sent[0]).toMatchObject({
      method: 'GET',
      url: 'https://api.ncc.vn/hub/v1/orders/TX1',
      rawBody: undefined,
      timeoutMs: 500,
    });
  });

  describe('callback', () => {
    const body = JSON.stringify({
      eventId: 'EV1',
      order: { requestId: 'TX1', orderId: 'N1', status: 'SUCCESS' },
    });
    const now = String(Math.floor(Date.now() / 1000));
    const raw = (headers: Record<string, string>, rawBody = body) => ({
      body: JSON.parse(rawBody) as unknown,
      rawBody,
      headers,
      ip: '1.2.3.4',
    });

    it('chữ ký đúng thì nhận', async () => {
      const signature = signCallback('cb_secret', now, body);
      await expect(
        adapter.verifyCallback(
          ctx,
          raw({
            'x-supplier-timestamp': now,
            'x-supplier-signature': signature,
          }),
        ),
      ).resolves.toBe(true);
    });

    it.each([
      [
        'sai chữ ký',
        { 'x-supplier-timestamp': now, 'x-supplier-signature': 'f'.repeat(64) },
      ],
      ['thiếu header', {}],
      [
        'timestamp quá cũ',
        {
          'x-supplier-timestamp': String(Number(now) - 600),
          'x-supplier-signature': signCallback(
            'cb_secret',
            String(Number(now) - 600),
            body,
          ),
        },
      ],
    ])('%s thì từ chối', async (_name, headers) => {
      await expect(adapter.verifyCallback(ctx, raw(headers))).resolves.toBe(
        false,
      );
    });

    it('chưa cấu hình callbackSecret thì từ chối mọi callback', async () => {
      const signature = signCallback('cb_secret', now, body);
      await expect(
        adapter.verifyCallback(
          { ...ctx, secrets: { secret: 'x' } },
          raw({
            'x-supplier-timestamp': now,
            'x-supplier-signature': signature,
          }),
        ),
      ).resolves.toBe(false);
    });

    it('đọc eventId, requestId, orderId và trạng thái', async () => {
      const parsed = await adapter.parseCallback(ctx, raw({}));
      expect(parsed).toMatchObject({
        eventId: 'EV1',
        transCode: 'TX1',
        supplierTransId: 'N1',
        result: { outcome: 'SUCCESS' },
      });
    });

    it('thiếu eventId hoặc order thì báo lỗi định dạng', () => {
      expect(() =>
        adapter.parseCallback(ctx, raw({}, JSON.stringify({ order: {} }))),
      ).toThrow(InvalidCallbackPayloadError);
    });
  });
});
