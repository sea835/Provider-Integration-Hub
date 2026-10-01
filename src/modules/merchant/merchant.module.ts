import { Module } from '@nestjs/common';
import { MerchantRepositoryPort } from '@modules/merchant/domain/merchant.repository.port';
import { MerchantRepository } from '@modules/merchant/infrastructure/merchant.repository';
import { MerchantService } from '@modules/merchant/application/merchant.service';
import { MerchantAuthService } from '@modules/merchant/application/merchant-auth.service';
import { MerchantApiKeyGuard } from '@modules/merchant/presentation/guards/merchant-api-key.guard';
import { AdminMerchantController } from '@modules/merchant/presentation/admin-merchant.controller';

/** Store (merchant) gọi Core bằng X-Api-Key. */
@Module({
  controllers: [AdminMerchantController],
  providers: [
    MerchantService,
    MerchantAuthService,
    MerchantApiKeyGuard,
    { provide: MerchantRepositoryPort, useClass: MerchantRepository },
  ],
  exports: [MerchantAuthService, MerchantApiKeyGuard],
})
export class MerchantModule {}
