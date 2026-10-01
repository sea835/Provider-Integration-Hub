import { Inject, Injectable } from '@nestjs/common';
import { LoggerPort, LogLayer } from '@common/logger';
import { SecretCipherPort } from '@common/crypto/secret-cipher.port';
import { omitUndefined } from '@common/libs/omit-undefined';
import {
  PaginatedResult,
  PaginationQueryDto,
} from '@common/base/pagination.dto';
import { SupplierEntity } from '@modules/supplier/domain/supplier.entity';
import { SupplierRepositoryPort } from '@modules/supplier/domain/supplier.repository.port';
import { SupplierStatus } from '@modules/supplier/domain/supplier-status';
import { AdapterSpecPort } from '@modules/supplier/domain/adapter-spec.port';
import { SupplierEventsPort } from '@modules/supplier/domain/supplier-events.port';
import {
  InvalidSupplierConfigError,
  SupplierNotFoundError,
} from '@modules/supplier/domain/supplier.errors';
import {
  CreateSupplierInput,
  UpdateSupplierInput,
} from '@modules/supplier/application/supplier.inputs';
import { SupplierConfigService } from '@modules/supplier/application/supplier-config.service';
import type { ConnectionTestResult } from '@modules/provider-adapter/domain/provider-adapter.port';

@Injectable()
export class SupplierService {
  private readonly logger: LoggerPort;

  constructor(
    @Inject(SupplierRepositoryPort)
    private readonly suppliers: SupplierRepositoryPort,
    private readonly cipher: SecretCipherPort,
    private readonly adapterSpec: AdapterSpecPort,
    private readonly events: SupplierEventsPort,
    private readonly configs: SupplierConfigService,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.APPLICATION,
      'Supplier',
      SupplierService.name,
    );
  }

  list(query: PaginationQueryDto): Promise<PaginatedResult<SupplierEntity>> {
    return this.suppliers.findPaginated!(query);
  }

  async get(id: string): Promise<SupplierEntity> {
    const supplier = await this.suppliers.findById(id);
    if (!supplier) throw new SupplierNotFoundError(id);
    return supplier;
  }

  async create(
    input: CreateSupplierInput,
    actorId?: string,
  ): Promise<SupplierEntity> {
    const { secrets, params = {}, ...rest } = input;
    await this.assertValidConfig(input.adapterType, params, secrets ?? null);

    const created = await this.suppliers.create({
      ...omitUndefined(rest),
      code: input.code.trim().toUpperCase(),
      params,
      status: SupplierStatus.PAUSED,
      secretsEnc: secrets ? this.cipher.encrypt(secrets) : null,
      createdBy: actorId ?? null,
      updatedBy: actorId ?? null,
    });

    this.logger.info('Tạo nhà cung cấp', {
      code: created.code,
      adapterType: created.adapterType,
    });
    await this.notifyChanged(created);
    return created;
  }

  async update(
    id: string,
    input: UpdateSupplierInput,
    actorId?: string,
  ): Promise<SupplierEntity> {
    const existing = await this.get(id);
    const { secrets, ...rest } = input;

    if (input.params !== undefined || secrets !== undefined) {
      await this.assertValidConfig(
        existing.adapterType,
        input.params ?? existing.params,
        secrets ?? null,
      );
    }

    const updated = await this.suppliers.updateWithVersion(id, {
      ...omitUndefined(rest),
      ...(secrets ? { secretsEnc: this.cipher.encrypt(secrets) } : {}),
      updatedBy: actorId ?? null,
    });
    if (!updated) throw new SupplierNotFoundError(id);

    this.logger.info('Cập nhật nhà cung cấp', {
      code: updated.code,
      version: updated.version,
      status: updated.status,
      secretsChanged: Boolean(secrets),
    });
    await this.notifyChanged(updated);
    return updated;
  }

  async testConnection(id: string): Promise<ConnectionTestResult> {
    const supplier = await this.get(id);
    this.configs.invalidateByCode(supplier.code);
    const config = await this.configs.getById(id);
    return this.adapterSpec.testConnection(
      config.adapterType,
      this.configs.toContext(config),
    );
  }

  private async assertValidConfig(
    adapterType: string,
    params: Record<string, unknown>,
    secrets: Record<string, unknown> | null,
  ): Promise<void> {
    if (!this.adapterSpec.types().includes(adapterType)) {
      throw new InvalidSupplierConfigError([
        `adapterType phải là một trong: ${this.adapterSpec.types().join(', ')}`,
      ]);
    }
    const issues = await this.adapterSpec.validateConfig(
      adapterType,
      params,
      secrets,
    );
    if (issues.length > 0) throw new InvalidSupplierConfigError(issues);
  }

  private async notifyChanged(supplier: SupplierEntity): Promise<void> {
    try {
      await this.events.publishChanged({
        code: supplier.code,
        version: supplier.version,
      });
    } catch (error) {
      this.logger.warn('Không phát được sự kiện đổi cấu hình NCC', {
        code: supplier.code,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
