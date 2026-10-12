import {
  AlertSettings,
  AlertState,
  decideAlerts,
  levelOf,
} from '@modules/provider/domain/alert-policy';

const settings: AlertSettings = {
  warningThreshold: 50_000_000,
  criticalThreshold: 10_000_000,
  cooldownMinutes: 60,
  intervalMinutes: 15,
};
const now = new Date('2026-10-12T03:00:00.000Z');
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60_000);
const state = (patch: Partial<AlertState> = {}): AlertState => ({
  alertLevel: 'OK',
  alertSentAt: null,
  consecutiveFailures: 0,
  ...patch,
});

describe('levelOf', () => {
  it('dưới ngưỡng khẩn cấp là CRITICAL, dưới ngưỡng cảnh báo sớm là WARNING', () => {
    expect(levelOf(60_000_000, 50_000_000, 10_000_000)).toBe('OK');
    expect(levelOf(50_000_000, 50_000_000, 10_000_000)).toBe('OK');
    expect(levelOf(49_999_999, 50_000_000, 10_000_000)).toBe('WARNING');
    expect(levelOf(9_000_000, 50_000_000, 10_000_000)).toBe('CRITICAL');
    expect(levelOf(0, null, null)).toBe('OK');
    expect(levelOf(null, 50_000_000, 10_000_000)).toBe('OK');
  });
});

describe('decideAlerts', () => {
  it('OK → WARNING: gửi ngay', () => {
    const decision = decideAlerts(
      state(),
      settings,
      { ok: true, balance: 40_000_000 },
      now,
    );
    expect(decision.events).toEqual([
      {
        kind: 'LEVEL',
        level: 'WARNING',
        reminder: false,
        balance: 40_000_000,
        threshold: 50_000_000,
      },
    ]);
    expect(decision.next).toEqual({
      alertLevel: 'WARNING',
      alertSentAt: now,
      consecutiveFailures: 0,
    });
  });

  it('vẫn WARNING: im lặng trong cooldown, nhắc lại khi hết cooldown', () => {
    const quiet = decideAlerts(
      state({ alertLevel: 'WARNING', alertSentAt: minutesAgo(30) }),
      settings,
      { ok: true, balance: 40_000_000 },
      now,
    );
    expect(quiet.events).toEqual([]);
    expect(quiet.next.alertSentAt).toEqual(minutesAgo(30));

    const reminder = decideAlerts(
      state({ alertLevel: 'WARNING', alertSentAt: minutesAgo(60) }),
      settings,
      { ok: true, balance: 40_000_000 },
      now,
    );
    expect(reminder.events).toMatchObject([
      { kind: 'LEVEL', level: 'WARNING', reminder: true },
    ]);
    expect(reminder.next.alertSentAt).toEqual(now);
  });

  it('WARNING → CRITICAL: gửi ngay dù đang trong cooldown', () => {
    const decision = decideAlerts(
      state({ alertLevel: 'WARNING', alertSentAt: minutesAgo(5) }),
      settings,
      { ok: true, balance: 5_000_000 },
      now,
    );
    expect(decision.events).toMatchObject([
      { kind: 'LEVEL', level: 'CRITICAL', reminder: false },
    ]);
  });

  it('về OK: gửi thông báo phục hồi và xoá mốc đã gửi', () => {
    const decision = decideAlerts(
      state({ alertLevel: 'CRITICAL', alertSentAt: minutesAgo(5) }),
      settings,
      { ok: true, balance: 200_000_000 },
      now,
    );
    expect(decision.events).toEqual([
      { kind: 'RECOVERED', balance: 200_000_000 },
    ]);
    expect(decision.next).toEqual({
      alertLevel: 'OK',
      alertSentAt: null,
      consecutiveFailures: 0,
    });
  });

  it('OK và vẫn OK: không gửi gì', () => {
    expect(
      decideAlerts(state(), settings, { ok: true, balance: 90_000_000 }, now)
        .events,
    ).toEqual([]);
  });

  it('lỗi kết nối: báo ở lần thứ 3, nhắc lại sau mỗi cooldown, giữ nguyên mức số dư', () => {
    const fail = (failures: number) =>
      decideAlerts(
        state({ alertLevel: 'WARNING', consecutiveFailures: failures }),
        settings,
        { ok: false, message: 'Hết thời gian chờ' },
        now,
      );
    expect(fail(0).events).toEqual([]);
    expect(fail(1).events).toEqual([]);
    expect(fail(2).events).toEqual([
      { kind: 'CONNECTION_FAILED', failures: 3, message: 'Hết thời gian chờ' },
    ]);
    expect(fail(3).events).toEqual([]);
    expect(fail(6).events).toMatchObject([
      { kind: 'CONNECTION_FAILED', failures: 7 },
    ]);
    expect(fail(2).next).toMatchObject({
      alertLevel: 'WARNING',
      consecutiveFailures: 3,
    });
  });

  it('thành công sau chuỗi lỗi đủ ngưỡng: báo đã kết nối lại', () => {
    const decision = decideAlerts(
      state({ consecutiveFailures: 4 }),
      settings,
      { ok: true, balance: 90_000_000 },
      now,
    );
    expect(decision.events).toEqual([
      { kind: 'RECONNECTED', balance: 90_000_000 },
    ]);
    expect(decision.next.consecutiveFailures).toBe(0);

    expect(
      decideAlerts(
        state({ consecutiveFailures: 2 }),
        settings,
        { ok: true, balance: 90_000_000 },
        now,
      ).events,
    ).toEqual([]);
  });
});
