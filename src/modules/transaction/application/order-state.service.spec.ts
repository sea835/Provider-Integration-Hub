import { OrderStateService } from '@modules/transaction/application/order-state.service';
import { TransactionEntity } from '@modules/transaction/domain/transaction.entity';
import {
  TransactionStatus,
  TransactionStatusType,
} from '@modules/transaction/domain/transaction-status';
import {
  EventSource,
  EventType,
} from '@modules/transaction/domain/transaction-event';
import {
  Outcome,
  OutcomeType,
  SupplierResult,
} from '@modules/provider-adapter/domain/supplier-result';
import { InvalidStateTransitionError } from '@modules/transaction/domain/transaction.errors';
import {
  TransactionEventRepositoryPort,
  TransactionRepositoryPort,
} from '@modules/transaction/domain/transaction.repository.port';
import { TransactionRunnerPort } from '@common/database/transaction-runner.port';

function makeOrder(
  overrides: Partial<TransactionEntity> = {},
): TransactionEntity {
  return {
    id: 'order-1',
    status: TransactionStatus.PROCESSING,
    transCode: 'TX1',
    merchantId: 'merchant-1',
    partnerTransId: 'REQ-1',
    requestHash: 'hash',
    action: 'ACTIVATE_SIM',
    supplierId: 'supplier-1',
    supplierCode: 'ANISIM',
    packageCode: 'plan-1',
    configVersion: 3,
    phone: null,
    serial: '8984012601500769003',
    supplierTransId: null,
    submitCount: 1,
    checkCount: 0,
    resubmitRequested: false,
    nextCheckAt: new Date(),
    delivery: {},
    errorCode: null,
    errorMessage: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function result(
  outcome: OutcomeType,
  extra: Partial<SupplierResult> = {},
): SupplierResult {
  return { outcome, trace: { durationMs: 10 }, ...extra };
}

describe('OrderStateService', () => {
  let current: TransactionEntity | null;
  let orders: {
    lockByTransCode: jest.Mock;
    findByTransCode: jest.Mock;
    update: jest.Mock;
  };
  let events: { record: jest.Mock };
  let service: OrderStateService;

  const setOrder = (order: TransactionEntity | null) => {
    current = order;
  };

  beforeEach(() => {
    current = makeOrder();
    orders = {
      lockByTransCode: jest.fn(() => Promise.resolve(current)),
      findByTransCode: jest.fn(() => Promise.resolve(current)),
      update: jest.fn((_id: string, patch: Partial<TransactionEntity>) => {
        current = { ...current!, ...patch };
        return Promise.resolve(current);
      }),
    };
    events = { record: jest.fn().mockResolvedValue(undefined) };
    const runner = { run: (fn: () => Promise<unknown>) => fn() };
    const logger = {
      child: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    service = new OrderStateService(
      orders as unknown as TransactionRepositoryPort,
      events as unknown as TransactionEventRepositoryPort,
      runner as unknown as TransactionRunnerPort,
      logger,
    );
  });

  describe('applyResult: ma trận trạng thái × outcome', () => {
    const cases: Array<{
      from: TransactionStatusType;
      outcome: OutcomeType;
      to: TransactionStatusType;
      conflict: boolean;
    }> = [
      {
        from: 'PROCESSING',
        outcome: 'SUCCESS',
        to: 'COMPLETED',
        conflict: false,
      },
      { from: 'PROCESSING', outcome: 'FAILED', to: 'FAILED', conflict: false },
      {
        from: 'PROCESSING',
        outcome: 'PENDING',
        to: 'PROCESSING',
        conflict: false,
      },
      {
        from: 'PROCESSING',
        outcome: 'UNKNOWN',
        to: 'PROCESSING',
        conflict: false,
      },
      {
        from: 'PROCESSING',
        outcome: 'NOT_FOUND',
        to: 'PROCESSING',
        conflict: false,
      },
      {
        from: 'MANUAL_REVIEW',
        outcome: 'SUCCESS',
        to: 'COMPLETED',
        conflict: false,
      },
      {
        from: 'MANUAL_REVIEW',
        outcome: 'FAILED',
        to: 'FAILED',
        conflict: false,
      },
      {
        from: 'MANUAL_REVIEW',
        outcome: 'UNKNOWN',
        to: 'MANUAL_REVIEW',
        conflict: false,
      },
      {
        from: 'COMPLETED',
        outcome: 'SUCCESS',
        to: 'COMPLETED',
        conflict: false,
      },
      { from: 'COMPLETED', outcome: 'FAILED', to: 'COMPLETED', conflict: true },
      {
        from: 'COMPLETED',
        outcome: 'UNKNOWN',
        to: 'COMPLETED',
        conflict: false,
      },
      { from: 'FAILED', outcome: 'SUCCESS', to: 'FAILED', conflict: true },
      { from: 'FAILED', outcome: 'FAILED', to: 'FAILED', conflict: false },
      {
        from: 'CANCELLED',
        outcome: 'SUCCESS',
        to: 'CANCELLED',
        conflict: true,
      },
    ];

    it.each(cases)(
      '$from + $outcome → $to (mâu thuẫn: $conflict)',
      async ({ from, outcome, to, conflict }) => {
        setOrder(makeOrder({ status: from }));

        const output = await service.applyResult(
          'TX1',
          result(outcome),
          EventSource.CHECK,
        );

        expect(output!.order.status).toBe(to);
        expect(output!.conflict).toBe(conflict);
        expect(events.record).toHaveBeenCalledWith(
          expect.objectContaining({
            type: conflict ? EventType.CONFLICT : EventType.RESULT,
            outcome,
            fromStatus: from,
            toStatus: to,
          }),
        );
      },
    );
  });

  it('SUCCESS lưu mã NCC, delivery và thời điểm hoàn tất', async () => {
    const output = await service.applyResult(
      'TX1',
      result(Outcome.SUCCESS, {
        supplierTransId: 'NCC-1',
        delivery: { msisdn: '0911111111', lpa: 'LPA:1$x$y' },
      }),
      EventSource.CALLBACK,
    );

    expect(output!.order).toMatchObject({
      status: TransactionStatus.COMPLETED,
      supplierTransId: 'NCC-1',
      delivery: { msisdn: '0911111111', lpa: 'LPA:1$x$y' },
      nextCheckAt: null,
    });
    expect(output!.order.completedAt).toBeInstanceOf(Date);
  });

  it('FAILED lưu mã lỗi và thông điệp của NCC', async () => {
    await service.applyResult(
      'TX1',
      result(Outcome.FAILED, {
        error: { code: 'ANI_4001', message: 'Serial is not available' },
      }),
      EventSource.SUBMIT,
    );

    expect(current).toMatchObject({
      status: TransactionStatus.FAILED,
      errorCode: 'ANI_4001',
      errorMessage: 'Serial is not available',
    });
  });

  it('PENDING bổ sung supplierTransId nhưng không ghi đè mã đã có', async () => {
    await service.applyResult(
      'TX1',
      result(Outcome.PENDING, { supplierTransId: 'NCC-A' }),
      EventSource.SUBMIT,
    );
    expect(current!.supplierTransId).toBe('NCC-A');

    await service.applyResult(
      'TX1',
      result(Outcome.PENDING, { supplierTransId: 'NCC-B' }),
      EventSource.CHECK,
    );
    expect(current!.supplierTransId).toBe('NCC-A');
  });

  it('không tìm thấy đơn thì trả null và không ghi gì', async () => {
    setOrder(null);
    await expect(
      service.applyResult(
        'TX404',
        result(Outcome.SUCCESS),
        EventSource.CALLBACK,
      ),
    ).resolves.toBeNull();
    expect(orders.update).not.toHaveBeenCalled();
    expect(events.record).not.toHaveBeenCalled();
  });

  describe('markSubmitting', () => {
    it('PENDING → PROCESSING, tăng submitCount, đặt next_check_at bảo vệ', async () => {
      setOrder(
        makeOrder({ status: TransactionStatus.PENDING, submitCount: 0 }),
      );
      const before = Date.now();

      const order = await service.markSubmitting('TX1', 60);

      expect(order).toMatchObject({
        status: TransactionStatus.PROCESSING,
        submitCount: 1,
        resubmitRequested: false,
      });
      expect(order!.nextCheckAt!.getTime()).toBeGreaterThanOrEqual(
        before + 60_000,
      );
    });

    it('PROCESSING có resubmitRequested thì được gửi lại', async () => {
      setOrder(makeOrder({ resubmitRequested: true, submitCount: 1 }));
      const order = await service.markSubmitting('TX1', 60);
      expect(order).toMatchObject({ submitCount: 2, resubmitRequested: false });
    });

    it.each([
      [TransactionStatus.PROCESSING, false],
      [TransactionStatus.COMPLETED, false],
      [TransactionStatus.FAILED, false],
      [TransactionStatus.MANUAL_REVIEW, false],
    ])('%s (resubmit=%s) thì không gửi', async (status, resubmitRequested) => {
      setOrder(makeOrder({ status, resubmitRequested }));
      await expect(service.markSubmitting('TX1', 60)).resolves.toBeNull();
      expect(orders.update).not.toHaveBeenCalled();
    });
  });

  describe('moveToManualReview', () => {
    it('PROCESSING → MANUAL_REVIEW', async () => {
      const order = await service.moveToManualReview(
        'TX1',
        'quá hạn',
        EventSource.CHECK,
      );
      expect(order!.status).toBe(TransactionStatus.MANUAL_REVIEW);
    });

    it('đơn đã chốt thì không đổi', async () => {
      setOrder(makeOrder({ status: TransactionStatus.COMPLETED }));
      await expect(
        service.moveToManualReview('TX1', 'x', EventSource.CHECK),
      ).resolves.toBeNull();
    });
  });

  describe('resolve (vận hành)', () => {
    it('MANUAL_REVIEW → FAILED, ghi event nguồn OPERATOR', async () => {
      setOrder(makeOrder({ status: TransactionStatus.MANUAL_REVIEW }));
      const order = await service.resolve(
        'TX1',
        Outcome.FAILED,
        'NCC xác nhận lỗi',
        'admin-1',
      );
      expect(order.status).toBe(TransactionStatus.FAILED);
      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({ source: EventSource.OPERATOR }),
      );
    });

    it('đơn đã ở trạng thái cuối thì báo lỗi', async () => {
      setOrder(makeOrder({ status: TransactionStatus.COMPLETED }));
      await expect(
        service.resolve('TX1', Outcome.FAILED, 'x', 'admin-1'),
      ).rejects.toBeInstanceOf(InvalidStateTransitionError);
    });
  });
});
