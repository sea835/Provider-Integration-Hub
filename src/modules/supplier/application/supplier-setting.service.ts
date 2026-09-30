import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { BaseService } from '@common/base/base.service';
import { SupplierSettingEntity } from '../domain/supplier-setting.entity';
import { SupplierSettingRepositoryPort } from '../domain/supplier-setting.repository.port';
import { CreateSupplierSettingDto } from '../presentation/dto/create-supplier-setting.dto';
import { UpdateSupplierSettingDto } from '../presentation/dto/update-supplier-setting.dto';

@Injectable()
export class SupplierSettingService extends BaseService<SupplierSettingEntity> {
  constructor(
    @Inject(SupplierSettingRepositoryPort)
    private readonly supplierSettingRepository: SupplierSettingRepositoryPort,
  ) {
    super(supplierSettingRepository);
  }

  async createSetting(
    dto: CreateSupplierSettingDto,
  ): Promise<SupplierSettingEntity> {
    const existing = await this.supplierSettingRepository.findBySupplierId(
      dto.supplierId,
    );
    if (existing) {
      throw new ConflictException(
        `Supplier setting for supplierId [${dto.supplierId}] already exists`,
      );
    }

    return this.supplierSettingRepository.create({
      supplierId: dto.supplierId,
      baseUrl: dto.baseUrl,
      rateLimitRpm: dto.rateLimitRpm ?? 60,
      timeoutSeconds: dto.timeoutSeconds ?? 30,
      executionMode: dto.executionMode ?? 'ASYNC_CALLBACK',
      pollingIntervalSec: dto.pollingIntervalSec ?? 5,
      maxPollingRetries: dto.maxPollingRetries ?? 10,
      connectionParams: dto.connectionParams || null,
      whitelistIps: dto.whitelistIps || null,
      callbackWebhookUrl: dto.callbackWebhookUrl || null,
      metadata: dto.metadata || null,
      status: 'ACTIVE',
    });
  }

  async getBySupplierId(supplierId: string): Promise<SupplierSettingEntity> {
    const setting =
      await this.supplierSettingRepository.findBySupplierId(supplierId);
    if (!setting) {
      throw new NotFoundException(
        `Supplier setting for supplierId [${supplierId}] not found`,
      );
    }
    return setting;
  }

  async updateSetting(
    id: string,
    dto: UpdateSupplierSettingDto,
  ): Promise<SupplierSettingEntity> {
    const existing = await this.supplierSettingRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Supplier setting with id [${id}] not found`);
    }

    const updated = await this.supplierSettingRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException(`Failed to update supplier setting [${id}]`);
    }
    return updated;
  }
}
