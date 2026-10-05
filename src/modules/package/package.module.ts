import { Module } from '@nestjs/common';
import { MerchantModule } from '@modules/merchant/merchant.module';
import { SupplierModule } from '@modules/supplier/supplier.module';
import { ProviderAdapterModule } from '@modules/provider-adapter/provider-adapter.module';
import { PackageService } from '@modules/package/application/package.service';
import { PackageController } from '@modules/package/presentation/package.controller';

@Module({
  imports: [MerchantModule, SupplierModule, ProviderAdapterModule],
  controllers: [PackageController],
  providers: [PackageService],
})
export class PackageModule {}
