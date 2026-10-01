import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { LoggerPort, LogLayer } from '@common/logger';
import { SecretCipherPort } from '@common/crypto/secret-cipher.port';
import { SupplierEntity } from '@modules/supplier/domain/supplier.entity';
import {
  SupplierConfig,
  SupplierRuntimeInfo,
} from '@modules/supplier/domain/supplier-config';
import { SupplierRepositoryPort } from '@modules/supplier/domain/supplier.repository.port';
import { SupplierEventsPort } from '@modules/supplier/domain/supplier-events.port';
import { SupplierNotFoundError } from '@modules/supplier/domain/supplier.errors';
import type { SupplierContext } from '@modules/provider-adapter/domain/provider-adapter.port';

const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  config: SupplierConfig;
  expiresAt: number;
}

/**
 * Đọc cấu hình NCC lúc chạy (secret đã giải mã), cache 30s,
 * xoá cache ngay khi nhận sự kiện `supplier.changed`.
 */
@Injectable()
export class SupplierConfigService implements OnModuleInit {
  private readonly logger: LoggerPort;
  private readonly byId = new Map<string, CacheEntry>();
  private readonly idByCode = new Map<string, string>();

  constructor(
    @Inject(SupplierRepositoryPort)
    private readonly suppliers: SupplierRepositoryPort,
    private readonly cipher: SecretCipherPort,
    private readonly events: SupplierEventsPort,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.APPLICATION,
      'Supplier',
      SupplierConfigService.name,
    );
  }

  onModuleInit(): void {
    this.events.onChanged(({ code }) => this.invalidateByCode(code));
  }

  async getById(id: string): Promise<SupplierConfig> {
    const cached = this.byId.get(id);
    if (cached && cached.expiresAt > Date.now()) return cached.config;

    const entity = await this.suppliers.findById(id);
    if (!entity) throw new SupplierNotFoundError(id);
    return this.remember(entity);
  }

  async getByCode(code: string): Promise<SupplierConfig> {
    const id = this.idByCode.get(code);
    if (id) {
      const cached = this.byId.get(id);
      if (cached && cached.expiresAt > Date.now()) return cached.config;
    }

    const entity = await this.suppliers.findByCode(code);
    if (!entity) throw new SupplierNotFoundError(code);
    return this.remember(entity);
  }

  /** Đọc thẳng DB cho WorkerManager: không giải mã secret, không ghi cache. */
  async listRuntime(): Promise<SupplierRuntimeInfo[]> {
    const entities = await this.suppliers.listAll();
    return entities.map((entity) => ({
      id: entity.id,
      code: entity.code,
      status: entity.status,
      version: entity.version,
      concurrency: entity.concurrency,
      rateLimitPerMin: entity.rateLimitPerMin,
    }));
  }

  toContext(config: SupplierConfig): SupplierContext {
    return {
      supplierId: config.id,
      supplierCode: config.code,
      baseUrl: config.baseUrl.replace(/\/+$/, ''),
      secrets: config.secrets,
      params: config.params,
      timeouts: {
        submitMs: config.submitTimeoutMs,
        queryMs: config.queryTimeoutMs,
      },
      configVersion: config.version,
    };
  }

  invalidateByCode(code: string): void {
    const id = this.idByCode.get(code);
    if (id) this.byId.delete(id);
  }

  invalidateAll(): void {
    this.byId.clear();
  }

  private remember(entity: SupplierEntity): SupplierConfig {
    const { secretsEnc, ...rest } = entity;
    const config: SupplierConfig = {
      ...rest,
      secrets: this.decryptSecrets(entity.code, secretsEnc),
    };
    this.byId.set(entity.id, {
      config,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    this.idByCode.set(entity.code, entity.id);
    return config;
  }

  private decryptSecrets(
    code: string,
    secretsEnc: string | null,
  ): Record<string, unknown> {
    if (!secretsEnc) return {};
    try {
      return this.cipher.decrypt(secretsEnc);
    } catch (error) {
      this.logger.error('Không giải mã được secret của NCC', error, { code });
      return {};
    }
  }
}
