import { Module } from '@nestjs/common';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { StoreCallbackModule } from '@modules/store-callback/store-callback.module';
import { StoreCallbackDispatcher } from '@modules/store-callback/application/store-callback.dispatcher';

/** Chỉ import trong process worker: vòng gửi callback từ outbox. */
@Module({
  imports: [TransactionModule, StoreCallbackModule],
  providers: [StoreCallbackDispatcher],
  exports: [StoreCallbackDispatcher],
})
export class StoreCallbackWorkerModule {}
