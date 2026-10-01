import { Module } from '@nestjs/common';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { SupplierModule } from '@modules/supplier/supplier.module';
import { ProviderAdapterModule } from '@modules/provider-adapter/provider-adapter.module';
import { SubmitProcessor } from '@modules/execution/application/submit.processor';
import { CheckProcessor } from '@modules/execution/application/check.processor';
import { SweeperService } from '@modules/execution/application/sweeper.service';
import { WorkerManager } from '@modules/execution/infrastructure/worker-manager';

/** Chỉ import trong WorkerModule (process worker), KHÔNG import vào AppModule. */
@Module({
  imports: [TransactionModule, SupplierModule, ProviderAdapterModule],
  providers: [SubmitProcessor, CheckProcessor, SweeperService, WorkerManager],
  exports: [SubmitProcessor, CheckProcessor, SweeperService],
})
export class ExecutionModule {}
