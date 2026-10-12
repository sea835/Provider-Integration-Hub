import { LoggerPort } from '@common/logger';
import { BalanceCheckService } from '@modules/provider/application/balance-check.service';
import { ProviderSecrets } from '@modules/provider/application/provider-secrets';
import { AlertNotifierPort } from '@modules/provider/domain/alert-notifier.port';
import { BalanceCheckEntity } from '@modules/provider/domain/balance-check.entity';
import { BalanceCheckRepositoryPort } from '@modules/provider/domain/balance-check.repository.port';
import {
  BalanceProbePort,
  ProbeResult,
} from '@modules/provider/domain/balance-probe.port';
import { ProviderEntity } from '@modules/provider/domain/provider.entity';
import { ProviderRepositoryPort } from '@modules/provider/domain/provider.repository.port';
import {
  configOf,
  PlainCipher,
} from '@modules/provider/infrastructure/http-config/http-config.test-support';

const success = (balance: number): ProbeResult => ({
  ok: true,
  balance,
  rawValue: String(balance),
  httpStatus: 200,
  latencyMs: 12,
  steps: [],
  tokenPreview: null,
});

const failure = (transient: boolean): ProbeResult => ({
  ok: false,
  errorCode: transient ? 'TIMEOUT' : 'HTTP_400',
  errorMessage: transient ? 'Hết thời gian chờ' : 'Sai chữ ký',
  httpStatus: transient ? null : 400,
  latencyMs: 15,
  transient,
  steps: [],
  tokenPreview: null,
});

function setup(patch: Partial<ProviderEntity> = {}) {
  const provider = {
    id: 'p1',
    code: 'VIETTEL_DATA',
    name: 'Viettel Data',
    status: 'ACTIVE',
    config: configOf({
      baseUrl: 'https://api.partner.test',
      spec: {
        balance: {
          request: { method: 'GET', path: '/balance' },
          balancePath: 'body.balance',
        },
      },
    }),
    encryptedSecrets: null,
    unitMultiplier: 1,
    intervalMinutes: 15,
    warningThreshold: 50_000_000,
    criticalThreshold: 10_000_000,
    cooldownMinutes: 60,
    currentBalance: null,
    alertLevel: 'OK',
    alertSentAt: null,
    consecutiveFailures: 0,
    lastCheckedAt: null,
    lastStatus: null,
    ...patch,
  } as ProviderEntity;

  const updates: Array<Partial<ProviderEntity>> = [];
  const created: Array<Partial<BalanceCheckEntity>> = [];
  const sent: string[] = [];
  let next: ProbeResult = success(100_000_000);
  let delivers = true;

  const providers = {
    findById: jest.fn((id: string) =>
      Promise.resolve(id === provider.id ? provider : null),
    ),
    update: jest.fn((_id: string, data: Partial<ProviderEntity>) => {
      updates.push(data);
      return Promise.resolve({ ...provider, ...data });
    }),
  } as unknown as ProviderRepositoryPort;
  const checks = {
    create: jest.fn((data: Partial<BalanceCheckEntity>) => {
      created.push(data);
      return Promise.resolve({ id: 'c1', ...data } as BalanceCheckEntity);
    }),
    deleteOlderThan: jest.fn(() => Promise.resolve(4)),
  } as unknown as BalanceCheckRepositoryPort;
  const probe = {
    probe: jest.fn(() => Promise.resolve(next)),
  } as unknown as BalanceProbePort;
  const notifier = {
    send: jest.fn((text: string) => {
      if (delivers) sent.push(text);
      return Promise.resolve({ status: delivers ? 'SENT' : 'FAILED' });
    }),
  } as unknown as AlertNotifierPort;
  const logger = {
    child: () => logger,
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as LoggerPort;

  const service = new BalanceCheckService(
    providers,
    checks,
    new ProviderSecrets(new PlainCipher()),
    probe,
    notifier,
    logger,
  );
  return {
    service,
    provider,
    updates,
    created,
    sent,
    checks,
    probeResult: (result: ProbeResult) => (next = result),
    failDelivery: () => (delivers = false),
  };
}

describe('BalanceCheckService', () => {
  it('thành công: ghi lịch sử, cập nhật số dư, không cảnh báo khi trên ngưỡng', async () => {
    const t = setup();
    await expect(t.service.runScheduled('p1', true)).resolves.toBe('DONE');
    expect(t.created[0]).toMatchObject({
      providerId: 'p1',
      status: 'SUCCESS',
      balance: 100_000_000,
      httpStatus: 200,
      latencyMs: 12,
      errorCode: null,
    });
    expect(t.updates[0]).toMatchObject({
      currentBalance: 100_000_000,
      lastStatus: 'SUCCESS',
      alertLevel: 'OK',
      consecutiveFailures: 0,
    });
    expect(t.sent).toEqual([]);
  });

  it('số dư dưới ngưỡng cảnh báo sớm: gửi Telegram và lưu mức đã gửi', async () => {
    const t = setup();
    t.probeResult(success(40_000_000));
    await t.service.runScheduled('p1', true);
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toContain('CẢNH BÁO SỐ DƯ THẤP');
    expect(t.sent[0]).toContain('Viettel Data (VIETTEL_DATA)');
    expect(t.sent[0]).toContain('40.000.000 VNĐ');
    expect(t.updates[0]).toMatchObject({ alertLevel: 'WARNING' });
    expect(t.updates[0].alertSentAt).toBeInstanceOf(Date);
  });

  it('gửi Telegram thất bại: giữ nguyên mức đã gửi để lượt sau gửi lại', async () => {
    const t = setup();
    t.probeResult(success(5_000_000));
    t.failDelivery();
    await t.service.runScheduled('p1', true);
    expect(t.updates[0]).toMatchObject({
      currentBalance: 5_000_000,
      lastStatus: 'SUCCESS',
    });
    expect(t.updates[0]).not.toHaveProperty('alertLevel');
    expect(t.updates[0]).not.toHaveProperty('alertSentAt');
  });

  it('được nạp tiền: gửi thông báo phục hồi', async () => {
    const t = setup({ alertLevel: 'CRITICAL', alertSentAt: new Date() });
    t.probeResult(success(200_000_000));
    await t.service.runScheduled('p1', true);
    expect(t.sent).toEqual([
      '🟢 Viettel Data (VIETTEL_DATA) đã được nạp, số dư hiện tại 200.000.000 VNĐ',
    ]);
    expect(t.updates[0]).toMatchObject({ alertLevel: 'OK', alertSentAt: null });
  });

  it('lỗi tạm thời: còn lượt thử lại thì chưa ghi; hết lượt thì ghi lỗi', async () => {
    const t = setup();
    t.probeResult(failure(true));
    await expect(t.service.runScheduled('p1', true)).resolves.toBe('RETRY');
    expect(t.created).toHaveLength(0);

    await expect(t.service.runScheduled('p1', false)).resolves.toBe('DONE');
    expect(t.created[0]).toMatchObject({
      status: 'FAILED',
      balance: null,
      errorCode: 'TIMEOUT',
      errorMessage: 'Hết thời gian chờ',
    });
    expect(t.updates[0]).toMatchObject({
      lastStatus: 'FAILED',
      consecutiveFailures: 1,
    });
    expect(t.updates[0]).not.toHaveProperty('currentBalance');
  });

  it('lỗi nghiệp vụ ghi ngay, không thử lại; lỗi thứ 3 liên tiếp báo lỗi kết nối', async () => {
    const t = setup({ consecutiveFailures: 2 });
    t.probeResult(failure(false));
    await expect(t.service.runScheduled('p1', true)).resolves.toBe('DONE');
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toContain('LỖI KẾT NỐI');
    expect(t.sent[0]).toContain('3 lần liên tiếp');
    expect(t.updates[0]).toMatchObject({ consecutiveFailures: 3 });
  });

  it('đối tác tạm dừng hoặc đã xoá thì bỏ qua', async () => {
    const paused = setup({ status: 'PAUSED' });
    await expect(paused.service.runScheduled('p1', true)).resolves.toBe(
      'SKIPPED',
    );
    await expect(paused.service.runScheduled('missing', true)).resolves.toBe(
      'GONE',
    );
    expect(paused.created).toHaveLength(0);
  });

  it('checkNow từ chối đối tác đang tạm dừng', async () => {
    const t = setup({ status: 'PAUSED' });
    await expect(t.service.checkNow('p1')).rejects.toThrow(
      'Đối tác đang tạm dừng',
    );
  });

  it('dọn lịch sử cũ hơn 90 ngày', async () => {
    const t = setup();
    await expect(t.service.cleanup()).resolves.toBe(4);
    const calls = (t.checks.deleteOlderThan as jest.Mock<unknown, [Date]>).mock
      .calls;
    const cutoff = calls[0][0];
    const days = (Date.now() - cutoff.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(90);
  });
});
