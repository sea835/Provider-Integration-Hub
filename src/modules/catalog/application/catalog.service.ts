import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PackagePlanEntity } from '../domain/package.entity';
import { ProviderAdapterRegistry } from '@modules/provider-adapter/application/provider-adapter.registry';
import { AnisimAdapter } from '@modules/provider-adapter/infrastructure/adapters/anisim.adapter';

@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly logger = new Logger(CatalogService.name);

  // Danh mục gói cước nội bộ (khởi tạo với các gói cước chuẩn của ANI SIM)
  private readonly packages = new Map<string, PackagePlanEntity>();

  constructor(
    private readonly adapterRegistry: ProviderAdapterRegistry,
    private readonly anisimAdapter: AnisimAdapter,
  ) {
    // Gói cước mẫu SM110 của ANI SIM theo tài liệu kien-truc-moi-erd-va-chuan-tich-hop-ncc.md
    this.registerPackage({
      sku: 'SM110',
      name: 'Gói cước SM110 (7GB/ngày)',
      telco: 'VINAPHONE',
      price: 110000,
      costPrice: 95000,
      cycleDays: 30,
      dataGbPerDay: 7,
      canActivate: true,
      canTopup: true,
      status: 'ACTIVE',
      providerCode: 'ANISIM',
      supplierPackageId: '87196a70-196c-48cc-9a00-02a8667d9bba',
    });
  }

  async onModuleInit() {
    // Có thể tự động sync danh mục từ ANI SIM khi khởi động nếu cấu hình API Key khả dụng
    await this.syncPackagesFromAnisim().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not sync packages from ANI SIM on init: ${msg}`);
    });
  }

  registerPackage(pkg: PackagePlanEntity): void {
    this.packages.set(pkg.sku.toUpperCase(), pkg);
  }

  getPackageBySku(sku: string): PackagePlanEntity | null {
    return this.packages.get(sku.toUpperCase()) || null;
  }

  /**
   * Bước 1: Lấy danh mục gói cước khả dụng cho Store API (< 5ms)
   */
  getPackages(): PackagePlanEntity[] {
    return Array.from(this.packages.values()).filter(
      (pkg) => pkg.status === 'ACTIVE',
    );
  }

  /**
   * Bước 2: Kiểm tra điều kiện gói cước với thuê bao (< 1s)
   */
  async checkEligibility(
    phone: string,
    packageCode: string,
    context?: Record<string, any>,
  ): Promise<{ eligible: boolean; reason?: string }> {
    const pkg = this.getPackageBySku(packageCode);
    if (!pkg) {
      return {
        eligible: false,
        reason: `Package ${packageCode} not found in catalog`,
      };
    }

    if (pkg.status !== 'ACTIVE') {
      return {
        eligible: false,
        reason: `Package ${packageCode} is currently inactive`,
      };
    }

    // Điều hướng sang Adapter của nhà cung cấp (ANI SIM)
    const adapter = this.adapterRegistry.get(pkg.providerCode);
    if (!adapter || !adapter.checkEligibility) {
      return { eligible: true };
    }

    const checkResult = await adapter.checkEligibility(phone, packageCode, {
      ...context,
      packagePlan: pkg,
    });

    return {
      eligible: checkResult.isEligible,
      reason: checkResult.reason,
    };
  }

  /**
   * Đồng bộ danh mục gói từ ANI SIM về bộ nhớ
   */
  async syncPackagesFromAnisim(): Promise<number> {
    const remotePlans = await this.anisimAdapter.fetchPackagePlans();
    let count = 0;

    for (const plan of remotePlans) {
      this.registerPackage({
        sku: plan.code,
        name: plan.name,
        telco: 'VINAPHONE',
        price: 0,
        costPrice: 0,
        cycleDays: plan.cycleDays || 30,
        dataGbPerDay: plan.dataGbPerDay || 0,
        canActivate: plan.canActivate,
        canTopup: plan.canTopup,
        status: plan.status === 1 ? 'ACTIVE' : 'INACTIVE',
        providerCode: 'ANISIM',
        supplierPackageId: plan.id,
      });
      count++;
    }

    if (count > 0) {
      this.logger.log(`Synced ${count} packages from ANI SIM`);
    }
    return count;
  }
}
