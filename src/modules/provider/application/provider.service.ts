import { Injectable } from '@nestjs/common';
import { LoggerPort, LogLayer } from '@common/logger';
import { omitUndefined } from '@common/libs/omit-undefined';
import {
  BalanceProbePort,
  LoginProbeResult,
  ProbeResult,
} from '@modules/provider/domain/balance-probe.port';
import { CheckSchedulerPort } from '@modules/provider/domain/check-scheduler.port';
import {
  ProviderConfig,
  defaultProviderConfig,
} from '@modules/provider/domain/provider-config';
import {
  parseProviderConfig,
  parseProviderSamples,
  readinessIssues,
} from '@modules/provider/domain/provider-config.validation';
import { ProviderEntity } from '@modules/provider/domain/provider.entity';
import {
  ProviderCodeTakenError,
  ProviderConfigInvalidError,
  ProviderNotFoundError,
  ProviderNotReadyError,
  ThresholdInvalidError,
} from '@modules/provider/domain/provider.errors';
import { ProviderRepositoryPort } from '@modules/provider/domain/provider.repository.port';
import {
  DEFAULT_INTERVAL_MINUTES,
  ProviderStatus,
} from '@modules/provider/domain/provider-status';
import {
  CreateProviderInput,
  TestConnectionInput,
  UpdateProviderConfigInput,
  UpdateProviderInput,
} from '@modules/provider/application/provider.inputs';
import { ProviderSecrets } from '@modules/provider/application/provider-secrets';

@Injectable()
export class ProviderService {
  private readonly logger: LoggerPort;

  constructor(
    private readonly providers: ProviderRepositoryPort,
    private readonly secrets: ProviderSecrets,
    private readonly scheduler: CheckSchedulerPort,
    private readonly probe: BalanceProbePort,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.APPLICATION,
      'Provider',
      ProviderService.name,
    );
  }

  list(): Promise<ProviderEntity[]> {
    return this.providers.listAll();
  }

  async get(id: string): Promise<ProviderEntity> {
    const provider = await this.providers.findById(id);
    if (!provider) throw new ProviderNotFoundError(id);
    return provider;
  }

  secretKeys(provider: ProviderEntity): string[] {
    return this.secrets.keys(provider.encryptedSecrets);
  }

  readiness(provider: ProviderEntity): string[] {
    return readinessIssues(provider.config, this.secretKeys(provider));
  }

  /** Đối tác mới luôn ở trạng thái tạm dừng cho tới khi cấu hình API xong và được bật. */
  async create(
    input: CreateProviderInput,
    userId?: string,
  ): Promise<ProviderEntity> {
    if (await this.providers.findByCode(input.code)) {
      throw new ProviderCodeTakenError(input.code);
    }
    this.assertThresholds(
      input.warningThreshold ?? null,
      input.criticalThreshold ?? null,
    );
    const provider = await this.providers.create({
      ...omitUndefined({ ...input }),
      intervalMinutes: input.intervalMinutes ?? DEFAULT_INTERVAL_MINUTES,
      status: ProviderStatus.PAUSED,
      config: defaultProviderConfig(),
      createdBy: userId,
      updatedBy: userId,
    });
    this.logger.info('Provider created', {
      providerId: provider.id,
      code: provider.code,
    });
    return provider;
  }

  async update(
    id: string,
    input: UpdateProviderInput,
    userId?: string,
  ): Promise<ProviderEntity> {
    const current = await this.get(id);
    const warning =
      input.warningThreshold !== undefined
        ? input.warningThreshold
        : current.warningThreshold;
    const critical =
      input.criticalThreshold !== undefined
        ? input.criticalThreshold
        : current.criticalThreshold;
    this.assertThresholds(warning, critical);

    const status = input.status ?? current.status;
    if (
      status === ProviderStatus.ACTIVE &&
      current.status !== ProviderStatus.ACTIVE
    ) {
      const issues = this.readiness(current);
      if (issues.length > 0) throw new ProviderNotReadyError(issues);
    }

    const updated = (await this.providers.update(id, {
      ...omitUndefined({ ...input }),
      updatedBy: userId,
    })) as ProviderEntity;
    await this.syncSchedule(current, updated);
    this.logger.info('Provider updated', {
      providerId: id,
      status: updated.status,
    });
    return updated;
  }

  async updateConfig(
    id: string,
    input: UpdateProviderConfigInput,
    userId?: string,
  ): Promise<ProviderEntity> {
    const current = await this.get(id);
    const config = this.parseConfig(input.config);
    const merged = this.secrets.merge(
      this.secrets.decrypt(current.encryptedSecrets),
      input.secrets,
    );
    if (current.status === ProviderStatus.ACTIVE) {
      const issues = readinessIssues(config, Object.keys(merged));
      if (issues.length > 0) throw new ProviderNotReadyError(issues);
    }
    const updated = (await this.providers.update(id, {
      config,
      encryptedSecrets: this.secrets.encrypt(merged),
      ...omitUndefined({ unitMultiplier: input.unitMultiplier }),
      updatedBy: userId,
    })) as ProviderEntity;
    this.logger.info('Provider config updated', { providerId: id });
    return updated;
  }

  /** Lưu phản hồi mẫu để chọn trường trên giao diện; không ảnh hưởng tới việc gọi API. */
  async updateSamples(
    id: string,
    raw: unknown,
    userId?: string,
  ): Promise<ProviderEntity> {
    const current = await this.get(id);
    const { samples, issues } = parseProviderSamples(raw, current.samples);
    if (issues.length > 0) throw new ProviderConfigInvalidError(issues);
    return (await this.providers.update(id, {
      samples,
      updatedBy: userId,
    })) as ProviderEntity;
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.scheduler.unschedule(id);
    await this.providers.delete(id);
    this.logger.info('Provider deleted', { providerId: id });
  }

  /**
   * Gọi thử bằng đúng engine của job nền với cấu hình đang soạn (chưa cần lưu).
   * Không ghi lịch sử, không gửi cảnh báo. Chỉ cần request gọi được: chưa khai báo
   * đường dẫn số dư / token vẫn gọi, để người cấu hình xem phản hồi rồi chọn trường.
   */
  async testConnection(
    input: TestConnectionInput,
    userId?: string,
  ): Promise<ProbeResult | LoginProbeResult> {
    const config = this.parseConfig(input.config);
    const stored = input.providerId
      ? this.secrets.decrypt(
          (await this.get(input.providerId)).encryptedSecrets,
        )
      : {};
    const secrets = this.secrets.merge(stored, input.secrets);
    const loginOnly = input.scope === 'login';
    const issues = readinessIssues(
      config,
      Object.keys(secrets),
      loginOnly ? 'TRY_LOGIN' : 'TRY_BALANCE',
    );
    if (issues.length > 0) throw new ProviderNotReadyError(issues);
    const probeInput = {
      cacheKey: input.providerId ?? `draft-${userId ?? 'anonymous'}`,
      config,
      secrets,
      unitMultiplier: input.unitMultiplier ?? 1,
      freshLogin: true,
    };
    return loginOnly
      ? this.probe.probeLogin(probeInput)
      : this.probe.probe(probeInput);
  }

  private parseConfig(raw: unknown): ProviderConfig {
    const { config, issues } = parseProviderConfig(raw);
    if (issues.length > 0) throw new ProviderConfigInvalidError(issues);
    return config;
  }

  private assertThresholds(
    warning: number | null,
    critical: number | null,
  ): void {
    if (warning !== null && critical !== null && critical > warning) {
      throw new ThresholdInvalidError();
    }
  }

  private async syncSchedule(
    before: ProviderEntity,
    after: ProviderEntity,
  ): Promise<void> {
    if (after.status !== ProviderStatus.ACTIVE) {
      if (before.status === ProviderStatus.ACTIVE) {
        await this.scheduler.unschedule(after.id);
      }
      return;
    }
    if (
      before.status !== ProviderStatus.ACTIVE ||
      before.intervalMinutes !== after.intervalMinutes
    ) {
      await this.scheduler.schedule(after.id, after.intervalMinutes);
    }
  }
}
