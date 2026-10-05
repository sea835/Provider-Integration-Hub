import { CheckProcessor } from '@modules/execution/application/check.processor';
import { SubmitProcessor } from '@modules/execution/application/submit.processor';
import { TransactionEntity } from '@modules/transaction/domain/transaction.entity';
import { TransactionStatus } from '@modules/transaction/domain/transaction-status';
import { TransactionRepositoryPort } from '@modules/transaction/domain/transaction.repository.port';
import { OrderQueuePort } from '@modules/transaction/domain/order-queue.port';
import { OrderStateService } from '@modules/transaction/application/order-state.service';
import { SupplierConfigService } from '@modules/supplier/application/supplier-config.service';
import { AdapterRegistry } from '@modules/provider-adapter/application/adapter-registry';
import {
  OutcomeType,
  SupplierResult,
} from '@modules/provider-adapter/domain/supplier-result';
import { LoggerPort } from '@common/logger';

const config = {
  id: 's1',
  code: 'ANISIM',
  adapterType: 'ANISIM',
  status: 'ACTIVE',
  submitTimeoutMs: 15000,
  pollScheduleSec: [5, 10, 30],
  maxWaitSec: 3600,
  maxResubmit: 2,
};

function order(overrides: Partial<TransactionEntity> = {}): TransactionEntity {
  return {
    transCode: 'TX1',
    status: TransactionStatus.PROCESSING,
    supplierId: 's1',
    supplierCode: 'ANISIM',
    supplierTransId: null,
    submitCount: 1,
    checkCount: 0,
    checkWindowStartedAt: null,
    checkWindowBase: 0,
    resubmitRequested: false,
    createdAt: new Date(),
    action: 'ACTIVATE_SIM',
    phone: null,
    serial: '8984',
    packageCode: 'plan',
    ...overrides,
  } as TransactionEntity;
}

describe('Processors', () => {
  let current: TransactionEntity;
  let adapterResult: SupplierResult;
  let orders: { findByTransCode: jest.Mock };
  let state: Record<string, jest.Mock>;
  let queue: { enqueueSubmit: jest.Mock; enqueueCheck: jest.Mock };
  let configs: { getById: jest.Mock; toContext: jest.Mock };
  let adapter: { submit: jest.Mock; query: jest.Mock };
  let check: CheckProcessor;
  let submit: SubmitProcessor;

  const give = (outcome: OutcomeType) => {
    adapterResult = { outcome, trace: { durationMs: 1 } };
  };

  beforeEach(() => {
    current = order();
    give('PENDING');
    orders = { findByTransCode: jest.fn(() => Promise.resolve(current)) };
    const keep = () => Promise.resolve(current);
    state = {
      markSubmitting: jest.fn(() => {
        current = {
          ...current,
          status: TransactionStatus.PROCESSING,
          submitCount: current.submitCount + 1,
        };
        return Promise.resolve(current);
      }),
      applyResult: jest.fn(() => {
        if (adapterResult.outcome === 'SUCCESS')
          current = {
            ...current,
            status: TransactionStatus.COMPLETED,
          };
        if (adapterResult.outcome === 'FAILED')
          current = {
            ...current,
            status: TransactionStatus.FAILED,
          };
        return Promise.resolve({
          order: current,
          changed: false,
          conflict: false,
        });
      }),
      scheduleCheck: jest.fn((_t: string, _d: number, count: boolean) => {
        current = {
          ...current,
          checkCount: current.checkCount + (count ? 1 : 0),
        };
        return Promise.resolve(current);
      }),
      requestResubmit: jest.fn(() => {
        current = { ...current, resubmitRequested: true };
        return Promise.resolve(current);
      }),
      moveToManualReview: jest.fn(keep),
    };
    queue = {
      enqueueSubmit: jest.fn().mockResolvedValue(undefined),
      enqueueCheck: jest.fn().mockResolvedValue(undefined),
    };
    configs = {
      getById: jest.fn(() => Promise.resolve({ ...config })),
      toContext: jest.fn(() => ({})),
    };
    adapter = {
      submit: jest.fn(() => Promise.resolve(adapterResult)),
      query: jest.fn(() => Promise.resolve(adapterResult)),
    };
    const registry = { get: jest.fn(() => adapter) };
    const logger = {
      child: jest.fn().mockReturnThis(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };

    const deps = [
      orders as unknown as TransactionRepositoryPort,
      state as unknown as OrderStateService,
      configs as unknown as SupplierConfigService,
      registry as unknown as AdapterRegistry,
      queue as unknown as OrderQueuePort,
      logger as unknown as LoggerPort,
    ] as const;
    check = new CheckProcessor(...deps);
    submit = new SubmitProcessor(...deps);
  });

  describe('SubmitProcessor: kiểm tra gói trước khi gửi', () => {
    let checkPackage: jest.Mock;

    beforeEach(() => {
      checkPackage = jest.fn(() =>
        Promise.resolve({
          eligible: false,
          reason: { code: 'NCC_NOT_ELIGIBLE', message: 'Không đủ điều kiện' },
          trace: { durationMs: 2 },
        }),
      );
      Object.assign(adapter, {
        checkPackage,
        features: () => ({
          packages: false,
          check: true,
          checkBeforeSubmit: true,
          orderList: false,
        }),
      });
    });

    it('lần gửi đầu, NCC báo không đăng ký được → FAILED ngay, không gửi đơn', async () => {
      current = order({ status: TransactionStatus.PENDING, submitCount: 0 });
      await submit.handle('TX1');
      expect(checkPackage).toHaveBeenCalledWith(
        {},
        {
          action: 'ACTIVATE_SIM',
          packageCode: 'plan',
          phone: null,
          serial: '8984',
        },
      );
      expect(adapter.submit).not.toHaveBeenCalled();
      expect(state.applyResult).toHaveBeenCalledWith(
        'TX1',
        expect.objectContaining({
          outcome: 'FAILED',
          error: { code: 'NCC_NOT_ELIGIBLE', message: 'Không đủ điều kiện' },
        }),
        'SUBMIT',
      );
    });

    it('chưa rõ (null) hoặc kiểm tra lỗi → vẫn gửi đơn như bình thường', async () => {
      current = order({ status: TransactionStatus.PENDING, submitCount: 0 });
      checkPackage.mockResolvedValueOnce({
        eligible: null,
        reason: null,
        trace: { durationMs: 1 },
      });
      await submit.handle('TX1');
      expect(adapter.submit).toHaveBeenCalledTimes(1);

      current = order({ status: TransactionStatus.PENDING, submitCount: 0 });
      checkPackage.mockRejectedValueOnce(new Error('bug'));
      await submit.handle('TX1');
      expect(adapter.submit).toHaveBeenCalledTimes(2);
    });

    it('lần gửi lại (sau NOT_FOUND) không kiểm tra nữa', async () => {
      current = order({ resubmitRequested: true, submitCount: 1 });
      await submit.handle('TX1');
      expect(checkPackage).not.toHaveBeenCalled();
      expect(adapter.submit).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ attempt: 2 }),
      );
    });
  });

  describe('SubmitProcessor', () => {
    it('PENDING từ NCC → hẹn CHECK đầu tiên theo pollScheduleSec[0]', async () => {
      current = order({ status: TransactionStatus.PENDING, submitCount: 0 });
      await expect(submit.handle('TX1')).resolves.toEqual({ kind: 'DONE' });
      expect(state.scheduleCheck).toHaveBeenCalledWith('TX1', 5, false);
      expect(queue.enqueueCheck).toHaveBeenCalledWith('ANISIM', 'TX1', 1, 5000);
    });

    it('NCC PAUSED → hoãn job, không gọi NCC', async () => {
      current = order({ status: TransactionStatus.PENDING });
      configs.getById.mockResolvedValue({ ...config, status: 'PAUSED' });
      await expect(submit.handle('TX1')).resolves.toEqual({
        kind: 'DELAY',
        delayMs: 60000,
      });
      expect(adapter.submit).not.toHaveBeenCalled();
    });

    it('adapter throw → coi là UNKNOWN, vẫn hẹn CHECK', async () => {
      current = order({ status: TransactionStatus.PENDING });
      adapter.submit.mockRejectedValue(new Error('bug'));
      await submit.handle('TX1');
      expect(state.applyResult).toHaveBeenCalledWith(
        'TX1',
        expect.objectContaining({ outcome: 'UNKNOWN' }),
        'SUBMIT',
      );
      expect(queue.enqueueCheck).toHaveBeenCalled();
    });

    it('đơn đã COMPLETED → không làm gì', async () => {
      current = order({ status: TransactionStatus.COMPLETED });
      await submit.handle('TX1');
      expect(state.markSubmitting).not.toHaveBeenCalled();
    });
  });

  describe('CheckProcessor', () => {
    it('PENDING → hẹn lần sau theo lịch (lần 2 dùng pollScheduleSec[1])', async () => {
      await check.handle('TX1');
      expect(state.scheduleCheck).toHaveBeenCalledWith('TX1', 10, true);
      expect(queue.enqueueCheck).toHaveBeenCalledWith(
        'ANISIM',
        'TX1',
        2,
        10000,
      );
    });

    it('hết lịch thì lặp phần tử cuối', async () => {
      current = order({ checkCount: 7 });
      await check.handle('TX1');
      expect(state.scheduleCheck).toHaveBeenCalledWith('TX1', 30, true);
    });

    it('NOT_FOUND và còn lượt → đánh dấu gửi lại + enqueue SUBMIT', async () => {
      give('NOT_FOUND');
      await check.handle('TX1');
      expect(state.requestResubmit).toHaveBeenCalledWith('TX1');
      expect(queue.enqueueSubmit).toHaveBeenCalledWith('ANISIM', 'TX1', 2);
    });

    it('NOT_FOUND và hết lượt gửi lại → MANUAL_REVIEW', async () => {
      give('NOT_FOUND');
      current = order({ submitCount: 3 });
      await check.handle('TX1');
      expect(state.moveToManualReview).toHaveBeenCalled();
      expect(queue.enqueueSubmit).not.toHaveBeenCalled();
    });

    it('quá maxWaitSec → MANUAL_REVIEW, không hẹn thêm', async () => {
      current = order({ createdAt: new Date(Date.now() - 2 * 3600 * 1000) });
      await check.handle('TX1');
      expect(state.moveToManualReview).toHaveBeenCalled();
      expect(queue.enqueueCheck).not.toHaveBeenCalled();
    });

    it('vận hành đã mở vòng tra cứu mới → tính hạn chờ và lịch poll từ mốc mới', async () => {
      current = order({
        createdAt: new Date(Date.now() - 2 * 3600 * 1000),
        checkWindowStartedAt: new Date(),
        checkCount: 7,
        checkWindowBase: 7,
      });
      await check.handle('TX1');
      expect(state.moveToManualReview).not.toHaveBeenCalled();
      expect(state.scheduleCheck).toHaveBeenCalledWith('TX1', 10, true);
    });

    it('vòng tra cứu mới cũng quá hạn → lại MANUAL_REVIEW', async () => {
      current = order({
        createdAt: new Date(Date.now() - 5 * 3600 * 1000),
        checkWindowStartedAt: new Date(Date.now() - 2 * 3600 * 1000),
        checkWindowBase: 3,
        checkCount: 9,
      });
      await check.handle('TX1');
      expect(state.moveToManualReview).toHaveBeenCalled();
    });

    it('SUCCESS → không hẹn thêm', async () => {
      give('SUCCESS');
      await check.handle('TX1');
      expect(queue.enqueueCheck).not.toHaveBeenCalled();
    });

    it('đơn đang chờ gửi lại → CHECK bỏ qua', async () => {
      current = order({ resubmitRequested: true });
      await check.handle('TX1');
      expect(adapter.query).not.toHaveBeenCalled();
    });
  });
});
