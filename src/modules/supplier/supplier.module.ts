import { Module } from '@nestjs/common';
import { ProviderAdapterModule } from '@modules/provider-adapter/provider-adapter.module';
import { SupplierRepositoryPort } from '@modules/supplier/domain/supplier.repository.port';
import { SupplierRepository } from '@modules/supplier/infrastructure/supplier.repository';
import { SupplierService } from '@modules/supplier/application/supplier.service';
import { SupplierConfigService } from '@modules/supplier/application/supplier-config.service';
import { AdminSupplierController } from '@modules/supplier/presentation/admin-supplier.controller';

@Module({
  imports: [ProviderAdapterModule],
  controllers: [AdminSupplierController],
  providers: [
    SupplierService,
    SupplierConfigService,
    { provide: SupplierRepositoryPort, useClass: SupplierRepository },
  ],
  exports: [SupplierService, SupplierConfigService, SupplierRepositoryPort],
})
export class SupplierModule {}
