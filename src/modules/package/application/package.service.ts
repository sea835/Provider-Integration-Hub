import { Injectable } from '@nestjs/common';
import { LoggerPort, LogLayer } from '@common/logger';
import { DomainError } from '@common/errors/domain-error';
import { AdapterRegistry } from '@modules/provider-adapter/application/adapter-registry';
import { OrderActionType } from '@modules/provider-adapter/domain/order-action';
import { SupplierPackage } from '@modules/provider-adapter/domain/provider-adapter.port';
import { defaultFieldRules } from '@modules/provider-adapter/domain/order-fields';
import { SupplierConfigService } from '@modules/supplier/application/supplier-config.service';
import { SupplierConfig } from '@modules/supplier/domain/supplier-config';
import { SupplierStatus } from '@modules/supplier/domain/supplier-status';
import { resolveOrderFields } from '@modules/transaction/domain/order-fields.policy';
import { normalizeVnPhone } from '@modules/transaction/domain/msisdn';
import { InvalidOrderRequestError } from '@modules/transaction/domain/transaction.errors';
import {
  FeatureNotSupportedError,
  PackageSupplierUnavailableError,
  SupplierCallFailedError,
} from '@modules/package/domain/package.errors';

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 500;

export interface PackageListInput {
  supplierCode: string;
  action?: OrderActionType;
  phone?: string;
  serial?: string;
}

export interface PackageListOutput {
  supplierCode: string;
  packages: SupplierPackage[];
}

export interface PackageCheckInput {
  supplierCode: string;
  action: OrderActionType;
  packageCode: string;
  phone?: string | null;
  serial?: string | null;
}

export interface PackageCheckOutput {
  supplierCode: string;
  packageCode: string;
  /** null: chưa rõ (NCC lỗi hoặc trả lời không đọc được). */
  eligible: boolean | null;
  reason: { code: string; message: string } | null;
}

/**
 * API 1 và 2 cho Store: Hub gọi sang NCC rồi trả về dạng chuẩn, không lưu danh mục gói.
 * Danh sách gói được nhớ 60 giây theo NCC + phiên bản cấu hình + bộ lọc để đỡ gọi NCC liên tục.
 */
@Injectable()
export class PackageService {
  private readonly logger: LoggerPort;
  private readonly cache = new Map<
    string,
    { expiresAt: number; value: PackageListOutput }
  >();

  constructor(
    private readonly suppliers: SupplierConfigService,
    private readonly adapters: AdapterRegistry,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.APPLICATION,
      'Package',
      PackageService.name,
    );
  }

  async listPackages(input: PackageListInput): Promise<PackageListOutput> {
    const supplier = await this.activeSupplier(input.supplierCode);
    const adapter = this.adapters.get(supplier.adapterType);
    const ctx = this.suppliers.toContext(supplier);
    if (!adapter.listPackages || !adapter.features?.(ctx).packages) {
      throw new FeatureNotSupportedError(supplier.code, 'danh sách gói');
    }
    const phone = this.phoneOf(input.phone);
    const serial = input.serial?.trim() || null;
    const key = [
      supplier.id,
      supplier.version,
      input.action ?? '',
      phone ?? '',
      serial ?? '',
    ].join(':');
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const result = await adapter.listPackages(ctx, {
      action: input.action ?? null,
      phone,
      serial,
    });
    if (!result.ok) {
      if (result.unsupported) {
        throw new FeatureNotSupportedError(supplier.code, 'danh sách gói');
      }
      this.logger.warn('Không lấy được danh sách gói', {
        supplier: supplier.code,
        message: result.message,
      });
      throw new SupplierCallFailedError(supplier.code, result.message);
    }
    const value = { supplierCode: supplier.code, packages: result.packages };
    this.remember(key, value);
    return value;
  }

  async checkPackage(input: PackageCheckInput): Promise<PackageCheckOutput> {
    const supplier = await this.activeSupplier(input.supplierCode);
    const adapter = this.adapters.get(supplier.adapterType);
    const ctx = this.suppliers.toContext(supplier);
    if (!adapter.checkPackage || !adapter.features?.(ctx).check) {
      throw new FeatureNotSupportedError(supplier.code, 'kiểm tra gói');
    }
    const fields = resolveOrderFields(
      input,
      (adapter.fieldRules?.(ctx) ?? defaultFieldRules())[input.action],
    );
    const packageCode = input.packageCode.trim();
    const result = await adapter.checkPackage(ctx, {
      action: input.action,
      packageCode,
      phone: fields.phone,
      serial: fields.serial,
    });
    if (result.unsupported) {
      throw new FeatureNotSupportedError(supplier.code, 'kiểm tra gói');
    }
    this.logger.info('Kiểm tra gói', {
      supplier: supplier.code,
      packageCode,
      eligible: result.eligible,
      reason: result.reason?.code,
    });
    return {
      supplierCode: supplier.code,
      packageCode,
      eligible: result.eligible,
      reason: result.reason,
    };
  }

  private phoneOf(raw: string | undefined): string | null {
    if (!raw) return null;
    const phone = normalizeVnPhone(raw);
    if (!phone) {
      throw new InvalidOrderRequestError(
        'Số điện thoại không hợp lệ (cần 10 số, bắt đầu bằng 0 hoặc 84)',
      );
    }
    return phone;
  }

  private remember(key: string, value: PackageListOutput): void {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const [oldest] = this.cache.keys();
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  }

  private async activeSupplier(code: string): Promise<SupplierConfig> {
    const normalized = code.trim().toUpperCase();
    let supplier: SupplierConfig;
    try {
      supplier = await this.suppliers.getByCode(normalized);
    } catch (error) {
      if (error instanceof DomainError) {
        throw new PackageSupplierUnavailableError(normalized);
      }
      throw error;
    }
    if (supplier.status !== SupplierStatus.ACTIVE) {
      throw new PackageSupplierUnavailableError(normalized);
    }
    return supplier;
  }
}
