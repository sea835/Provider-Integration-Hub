import { Module } from '@nestjs/common';
import { DrizzleModule } from '@infrastructure/database/drizzle.module';
import { SupplierSettingController } from './presentation/supplier-setting.controller';
import { SupplierAccountController } from './presentation/supplier-account.controller';
import { SupplierSettingService } from './application/supplier-setting.service';
import { SupplierAccountService } from './application/supplier-account.service';
import { SupplierSettingRepository } from './infrastructure/supplier-setting.repository';
import { SupplierSettingRepositoryPort } from './domain/supplier-setting.repository.port';
import { SupplierAccountRepository } from './infrastructure/supplier-account.repository';
import { SupplierAccountRepositoryPort } from './domain/supplier-account.repository.port';

@Module({
  imports: [DrizzleModule],
  controllers: [SupplierSettingController, SupplierAccountController],
  providers: [
    SupplierSettingService,
    SupplierAccountService,
    {
      provide: SupplierSettingRepositoryPort,
      useClass: SupplierSettingRepository,
    },
    {
      provide: SupplierAccountRepositoryPort,
      useClass: SupplierAccountRepository,
    },
  ],
  exports: [
    SupplierSettingService,
    SupplierAccountService,
    SupplierSettingRepositoryPort,
    SupplierAccountRepositoryPort,
  ],
})
export class SupplierModule {}
