import { Injectable } from '@nestjs/common';
import { PaginatedResult } from '@common/base/pagination.dto';
import { LoggerPort, LogLayer } from '@common/logger';
import { alertMessage } from '@modules/provider/domain/alert-message';
import { AlertNotifierPort } from '@modules/provider/domain/alert-notifier.port';
import {
  AlertEvent,
  AlertState,
  decideAlerts,
} from '@modules/provider/domain/alert-policy';
import { BalanceCheckEntity } from '@modules/provider/domain/balance-check.entity';
import {
  BalanceCheckFilter,
  BalanceCheckRepositoryPort,
  BalancePoint,
} from '@modules/provider/domain/balance-check.repository.port';
import {
  BalanceProbePort,
  ProbeResult,
} from '@modules/provider/domain/balance-probe.port';
import { readinessIssues } from '@modules/provider/domain/provider-config.validation';
import { ProviderEntity } from '@modules/provider/domain/provider.entity';
import {
  ProviderNotFoundError,
  ProviderNotReadyError,
  ProviderPausedError,
} from '@modules/provider/domain/provider.errors';
import { ProviderRepositoryPort } from '@modules/provider/domain/provider.repository.port';
import {
  AlertLevelType,
  CHECK_RETENTION_DAYS,
  CheckStatus,
  ProviderStatus,
} from '@modules/provider/domain/provider-status';
import { ProviderSecrets } from '@modules/provider/application/provider-secrets';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MAX_MESSAGE_LENGTH = 1000;

/** Khoảng thời gian của biểu đồ và độ rộng mỗi điểm (giây). */
export const SERIES_RANGES = {
  '5m': { spanMs: 5 * MINUTE_MS, bucketSeconds: 10 },
  '15m': { spanMs: 15 * MINUTE_MS, bucketSeconds: 10 },
  '30m': { spanMs: 30 * MINUTE_MS, bucketSeconds: 30 },
  '60m': { spanMs: HOUR_MS, bucketSeconds: 60 },
  '3h': { spanMs: 3 * HOUR_MS, bucketSeconds: 60 },
  '12h': { spanMs: 12 * HOUR_MS, bucketSeconds: 300 },
  '24h': { spanMs: DAY_MS, bucketSeconds: 300 },
  '7d': { spanMs: 7 * DAY_MS, bucketSeconds: 3600 },
  '30d': { spanMs: 30 * DAY_MS, bucketSeconds: 4 * 3600 },
} as const;
export type SeriesRange = keyof typeof SERIES_RANGES;

/** DONE: đã ghi kết quả. RETRY: lỗi tạm thời, chưa ghi. SKIPPED: đang tạm dừng. GONE: đã bị xoá. */
export type ScheduledOutcome = 'DONE' | 'RETRY' | 'SKIPPED' | 'GONE';

@Injectable()
export class BalanceCheckService {
  private readonly logger: LoggerPort;

  constructor(
    private readonly providers: ProviderRepositoryPort,
    private readonly checks: BalanceCheckRepositoryPort,
    private readonly secrets: ProviderSecrets,
    private readonly probe: BalanceProbePort,
    private readonly notifier: AlertNotifierPort,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.APPLICATION,
      'Provider',
      BalanceCheckService.name,
    );
  }

  /** Một lượt quét theo lịch. `allowRetry`: lỗi mạng tạm thời thì chưa ghi nhận, để job thử lại. */
  async runScheduled(
    providerId: string,
    allowRetry: boolean,
  ): Promise<ScheduledOutcome> {
    const provider = await this.providers.findById(providerId);
    if (!provider) return 'GONE';
    if (provider.status !== ProviderStatus.ACTIVE) return 'SKIPPED';
    const result = await this.run(provider);
    if (!result.ok && result.transient && allowRetry) return 'RETRY';
    await this.record(provider, result);
    return 'DONE';
  }

  /** Kiểm tra ngay theo yêu cầu của người dùng: ghi lịch sử và áp quy tắc cảnh báo như lượt quét nền. */
  async checkNow(providerId: string): Promise<BalanceCheckEntity> {
    const provider = await this.providers.findById(providerId);
    if (!provider) throw new ProviderNotFoundError(providerId);
    if (provider.status !== ProviderStatus.ACTIVE) {
      throw new ProviderPausedError();
    }
    const issues = readinessIssues(
      provider.config,
      this.secrets.keys(provider.encryptedSecrets),
    );
    if (issues.length > 0) throw new ProviderNotReadyError(issues);
    return this.record(provider, await this.run(provider));
  }

  history(
    filter: BalanceCheckFilter,
  ): Promise<PaginatedResult<BalanceCheckEntity>> {
    return this.checks.findPaginated(filter);
  }

  series(providerIds: string[], range: SeriesRange): Promise<BalancePoint[]> {
    const { spanMs, bucketSeconds } = SERIES_RANGES[range];
    return this.checks.series(
      providerIds,
      new Date(Date.now() - spanMs),
      bucketSeconds,
    );
  }

  async cleanup(): Promise<number> {
    const cutoff = new Date(Date.now() - CHECK_RETENTION_DAYS * DAY_MS);
    const removed = await this.checks.deleteOlderThan(cutoff);
    this.logger.info('Đã dọn lịch sử kiểm tra cũ', { removed, cutoff });
    return removed;
  }

  private run(provider: ProviderEntity): Promise<ProbeResult> {
    return this.probe.probe({
      cacheKey: provider.id,
      config: provider.config,
      secrets: this.secrets.decrypt(provider.encryptedSecrets),
      unitMultiplier: provider.unitMultiplier,
    });
  }

  private async record(
    provider: ProviderEntity,
    result: ProbeResult,
  ): Promise<BalanceCheckEntity> {
    const now = new Date();
    const check = await this.checks.create({
      providerId: provider.id,
      status: result.ok ? CheckStatus.SUCCESS : CheckStatus.FAILED,
      balance: result.ok ? result.balance : null,
      httpStatus: result.httpStatus,
      latencyMs: result.latencyMs,
      errorCode: result.ok ? null : result.errorCode,
      errorMessage: result.ok
        ? null
        : result.errorMessage.slice(0, MAX_MESSAGE_LENGTH),
      checkedAt: now,
    });

    const state: AlertState = {
      alertLevel: provider.alertLevel as AlertLevelType,
      alertSentAt: provider.alertSentAt,
      consecutiveFailures: provider.consecutiveFailures,
    };
    const decision = decideAlerts(
      state,
      provider,
      result.ok
        ? { ok: true, balance: result.balance }
        : { ok: false, message: result.errorMessage },
      now,
    );
    const balanceAlertsSent = await this.dispatch(provider, decision.events);

    await this.providers.update(provider.id, {
      ...(result.ok ? { currentBalance: result.balance } : {}),
      lastCheckedAt: now,
      lastStatus: check.status,
      consecutiveFailures: decision.next.consecutiveFailures,
      ...(balanceAlertsSent
        ? {
            alertLevel: decision.next.alertLevel,
            alertSentAt: decision.next.alertSentAt,
          }
        : {}),
    });
    return check;
  }

  /**
   * Gửi từng cảnh báo. Trả về false khi có cảnh báo SỐ DƯ chưa gửi được: khi đó giữ nguyên
   * mức đã gửi để lượt quét sau gửi lại. Chưa cấu hình kênh thì coi như đã xử lý.
   */
  private async dispatch(
    provider: ProviderEntity,
    events: AlertEvent[],
  ): Promise<boolean> {
    let balanceAlertsSent = true;
    for (const event of events) {
      const delivery = await this.notifier.send(alertMessage(provider, event));
      this.logger.info('Cảnh báo số dư', {
        providerId: provider.id,
        code: provider.code,
        kind: event.kind,
        delivery: delivery.status,
      });
      const aboutBalance = event.kind === 'LEVEL' || event.kind === 'RECOVERED';
      if (delivery.status === 'FAILED' && aboutBalance) {
        balanceAlertsSent = false;
      }
    }
    return balanceAlertsSent;
  }
}
