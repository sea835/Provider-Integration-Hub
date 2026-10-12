import { Module } from '@nestjs/common';
import { BalanceCheckWorker } from '@modules/provider/infrastructure/balance-check.worker';
import { ProviderCoreModule } from '@modules/provider/provider-core.module';

/** Tiến trình worker: quét số dư theo lịch và dọn lịch sử cũ. */
@Module({
  imports: [ProviderCoreModule],
  providers: [BalanceCheckWorker],
})
export class ProviderWorkerModule {}
