import { Module } from '@nestjs/common';
import { LoggerModule } from '@infrastructure/logger/logger.module';
import { DrizzleModule } from '@infrastructure/database/drizzle.module';
import { CryptoModule } from '@infrastructure/crypto/crypto.module';
import { QueueModule } from '@infrastructure/queue/queue.module';
import { ExecutionModule } from '@modules/execution/execution.module';
import { StoreCallbackWorkerModule } from '@modules/store-callback/store-callback-worker.module';

/** Process worker: không mở HTTP, chạy BullMQ workers + Sweeper + gửi callback về Store. */
@Module({
  imports: [
    LoggerModule,
    DrizzleModule,
    CryptoModule,
    QueueModule,
    ExecutionModule,
    StoreCallbackWorkerModule,
  ],
})
export class WorkerModule {}
