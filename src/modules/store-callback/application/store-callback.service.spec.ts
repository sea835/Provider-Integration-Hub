import { StoreCallbackService } from '@modules/store-callback/application/store-callback.service';
import {
  SendResult,
  signStoreCallback,
  StoreCallbackSender,
} from '@modules/store-callback/application/store-callback-sender';
import { MerchantService } from '@modules/merchant/application/merchant.service';
import { TransactionRepositoryPort } from '@modules/transaction/domain/transaction.repository.port';
import { OrderQueryService } from '@modules/transaction/application/order-query.service';
import {
  StoreCallbackEntity,
  StoreCallbackRepositoryPort,
  StoreCallbackStatus,
} from '@modules/transaction/domain/store-callback';
import { TransactionStatus } from '@modules/transaction/domain/transaction-status';
import { createHmac } from 'node:crypto';

function callback(
  overrides: Partial<StoreCallbackEntity> = {},
): StoreCallbackEntity {
  return {
    id: 'cb-1',
    transactionId: 'order-1',
    merchantId: 'm-1',
    transCode: 'T1',
    event: 'order.completed',
    status: StoreCallbackStatus.PENDING,
    attempts: 0,
    nextAttemptAt: new Date(),
    lastUrl: null,
    lastHttpStatus: null,
    lastDurationMs: null,
    lastError: null,
    lastResponse: null,
    deliveredAt: null,
    createdAt: new Date('2026-10-05T07:00:00Z'),
    updatedAt: new Date(),
    ...overrides,
  };
}

const sent = (overrides: Partial<SendResult> = {}): SendResult => ({
  ok: true,
  httpStatus: 200,
  durationMs: 12,
  error: null,
  response: 'OK',
  ...overrides,
});

describe('StoreCallbackService.deliver', () => {
  let repo: { recordAttempt: jest.Mock };
  let merchants: { callbackConfig: jest.Mock };
  let sender: { send: jest.Mock };
  let service: StoreCallbackService;

  beforeEach(() => {
    repo = { recordAttempt: jest.fn().mockResolvedValue(undefined) };
    merchants = {
      callbackConfig: jest.fn().mockResolvedValue({
        enabled: true,
        url: 'https://store.test/cb',
        secret: 'whsec_x',
      }),
    };
    sender = { send: jest.fn().mockResolvedValue(sent()) };
    const orders = {
      findById: jest.fn().mockResolvedValue({
        id: 'order-1',
        transCode: 'T1',
        partnerTransId: 'REQ-1',
        status: TransactionStatus.COMPLETED,
        delivery: { msisdn: '0912' },
        completedAt: new Date(),
        createdAt: new Date(),
      }),
    };
    const logger = {
      child: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };
    service = new StoreCallbackService(
      repo as unknown as StoreCallbackRepositoryPort,
      orders as unknown as TransactionRepositoryPort,
      {} as OrderQueryService,
      merchants as unknown as MerchantService,
      sender as unknown as StoreCallbackSender,
      logger,
    );
  });

  it('Store trả 2xx → DELIVERED, gửi đúng eventId và dữ liệu đơn công khai', async () => {
    await service.deliver(callback());
    expect(sender.send).toHaveBeenCalledWith(
      'https://store.test/cb',
      'whsec_x',
      expect.objectContaining({
        eventId: 'cb-1',
        event: 'order.completed',
        data: expect.objectContaining({
          transCode: 'T1',
          requestId: 'REQ-1',
          status: 'COMPLETED',
        }) as unknown,
      }),
    );
    expect(repo.recordAttempt).toHaveBeenCalledWith(
      'cb-1',
      expect.objectContaining({
        attempts: 1,
        status: StoreCallbackStatus.DELIVERED,
        nextAttemptAt: null,
      }),
    );
  });

  it('Store lỗi → còn PENDING, hẹn lần sau theo lịch giãn dần', async () => {
    sender.send.mockResolvedValue(
      sent({ ok: false, httpStatus: 500, error: 'HTTP 500' }),
    );
    const before = Date.now();
    await service.deliver(callback({ attempts: 2 }));
    const [, attempt] = repo.recordAttempt.mock.calls[0] as [
      string,
      { status: string; attempts: number; nextAttemptAt: Date },
    ];
    expect(attempt.status).toBe(StoreCallbackStatus.PENDING);
    expect(attempt.attempts).toBe(3);
    expect(attempt.nextAttemptAt.getTime() - before).toBeGreaterThanOrEqual(
      60_000,
    );
  });

  it('hết lượt → FAILED, không hẹn nữa', async () => {
    sender.send.mockResolvedValue(sent({ ok: false, httpStatus: 503 }));
    await service.deliver(callback({ attempts: 10 }));
    expect(repo.recordAttempt).toHaveBeenCalledWith(
      'cb-1',
      expect.objectContaining({
        attempts: 11,
        status: StoreCallbackStatus.FAILED,
        nextAttemptAt: null,
      }),
    );
  });

  it('Store chưa bật callback → SKIPPED, không gửi', async () => {
    merchants.callbackConfig.mockResolvedValue({
      enabled: false,
      url: 'https://store.test/cb',
      secret: 'whsec_x',
    });
    await service.deliver(callback());
    expect(sender.send).not.toHaveBeenCalled();
    expect(repo.recordAttempt).toHaveBeenCalledWith(
      'cb-1',
      expect.objectContaining({ status: StoreCallbackStatus.SKIPPED }),
    );
  });
});

describe('signStoreCallback', () => {
  it('HMAC-SHA256 hex trên `${timestamp}.${body}`', () => {
    const body = '{"a":1}';
    expect(signStoreCallback('k', '1700000000', body)).toBe(
      createHmac('sha256', 'k').update(`1700000000.${body}`).digest('hex'),
    );
  });
});
