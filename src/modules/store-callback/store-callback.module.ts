import { Module } from '@nestjs/common';
import { MerchantModule } from '@modules/merchant/merchant.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { HttpJsonClient } from '@modules/provider-adapter/infrastructure/http/http-json.client';
import { StoreCallbackSender } from '@modules/store-callback/application/store-callback-sender';
import { StoreCallbackService } from '@modules/store-callback/application/store-callback.service';
import { AdminStoreCallbackController } from '@modules/store-callback/presentation/admin-store-callback.controller';

/** Báo kết quả cuối của đơn về Store (webhook có ký). Gửi thật do StoreCallbackWorkerModule. */
@Module({
  imports: [MerchantModule, TransactionModule],
  controllers: [AdminStoreCallbackController],
  providers: [HttpJsonClient, StoreCallbackSender, StoreCallbackService],
  exports: [StoreCallbackService],
})
export class StoreCallbackModule {}
