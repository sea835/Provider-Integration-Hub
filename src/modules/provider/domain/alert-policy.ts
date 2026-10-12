import {
  AlertLevel,
  AlertLevelType,
  FAILURE_ALERT_THRESHOLD,
} from '@modules/provider/domain/provider-status';

export interface AlertState {
  alertLevel: AlertLevelType;
  alertSentAt: Date | null;
  consecutiveFailures: number;
}

export interface AlertSettings {
  warningThreshold: number | null;
  criticalThreshold: number | null;
  cooldownMinutes: number;
  intervalMinutes: number;
}

export type CheckOutcome =
  { ok: true; balance: number } | { ok: false; message: string };

export type AlertEvent =
  | {
      kind: 'LEVEL';
      level: 'WARNING' | 'CRITICAL';
      reminder: boolean;
      balance: number;
      threshold: number;
    }
  | { kind: 'RECOVERED'; balance: number }
  | { kind: 'CONNECTION_FAILED'; failures: number; message: string }
  | { kind: 'RECONNECTED'; balance: number };

export interface AlertDecision {
  events: AlertEvent[];
  /** Trạng thái mới nếu MỌI cảnh báo số dư trong `events` gửi được. */
  next: AlertState;
}

const RANK: Record<AlertLevelType, number> = { OK: 0, WARNING: 1, CRITICAL: 2 };

/** Mức theo số dư: dưới ngưỡng khẩn cấp là CRITICAL, dưới ngưỡng cảnh báo sớm là WARNING. */
export function levelOf(
  balance: number | null,
  warningThreshold: number | null,
  criticalThreshold: number | null,
): AlertLevelType {
  if (balance === null) return AlertLevel.OK;
  if (criticalThreshold !== null && balance < criticalThreshold) {
    return AlertLevel.CRITICAL;
  }
  if (warningThreshold !== null && balance < warningThreshold) {
    return AlertLevel.WARNING;
  }
  return AlertLevel.OK;
}

/**
 * Quyết định gửi cảnh báo nào sau một lần kiểm tra. Hàm thuần: không gửi, không ghi DB.
 * - Đổi sang mức WARNING / CRITICAL: gửi ngay. Vẫn ở mức đó: nhắc lại sau mỗi `cooldownMinutes`.
 * - Về OK: gửi thông báo phục hồi.
 * - Lỗi liên tiếp đủ FAILURE_ALERT_THRESHOLD lần: báo lỗi kết nối, rồi nhắc lại theo cooldown;
 *   lần thành công đầu tiên sau đó: báo đã kết nối lại.
 */
export function decideAlerts(
  state: AlertState,
  settings: AlertSettings,
  outcome: CheckOutcome,
  now: Date,
): AlertDecision {
  if (!outcome.ok) {
    const failures = state.consecutiveFailures + 1;
    const remindEvery = Math.max(
      1,
      Math.ceil(settings.cooldownMinutes / settings.intervalMinutes),
    );
    const due =
      failures >= FAILURE_ALERT_THRESHOLD &&
      (failures - FAILURE_ALERT_THRESHOLD) % remindEvery === 0;
    return {
      events: due
        ? [{ kind: 'CONNECTION_FAILED', failures, message: outcome.message }]
        : [],
      next: { ...state, consecutiveFailures: failures },
    };
  }

  const events: AlertEvent[] = [];
  if (state.consecutiveFailures >= FAILURE_ALERT_THRESHOLD) {
    events.push({ kind: 'RECONNECTED', balance: outcome.balance });
  }

  const level = levelOf(
    outcome.balance,
    settings.warningThreshold,
    settings.criticalThreshold,
  );
  const next: AlertState = {
    alertLevel: level,
    alertSentAt: state.alertSentAt,
    consecutiveFailures: 0,
  };

  if (level === AlertLevel.OK) {
    if (RANK[state.alertLevel] > RANK.OK) {
      events.push({ kind: 'RECOVERED', balance: outcome.balance });
    }
    next.alertSentAt = null;
    return { events, next };
  }

  const threshold =
    level === AlertLevel.CRITICAL
      ? (settings.criticalThreshold as number)
      : (settings.warningThreshold as number);
  const changed = level !== state.alertLevel;
  const cooledDown =
    state.alertSentAt === null ||
    now.getTime() - state.alertSentAt.getTime() >=
      settings.cooldownMinutes * 60_000;
  if (changed || cooledDown) {
    events.push({
      kind: 'LEVEL',
      level,
      reminder: !changed,
      balance: outcome.balance,
      threshold,
    });
    next.alertSentAt = now;
  }
  return { events, next };
}
