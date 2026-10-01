import { Module } from '@nestjs/common';
import { LoggerModule } from '@infrastructure/logger/logger.module';
import { DrizzleModule } from '@infrastructure/database/drizzle.module';
import { CryptoModule } from '@infrastructure/crypto/crypto.module';
import { QueueModule } from '@infrastructure/queue/queue.module';
import { ExecutionModule } from '@modules/execution/execution.module';

/** Process worker: không mở HTTP, chỉ chạy BullMQ workers + Sweeper. */
@Module({
  imports: [
    LoggerModule,
    DrizzleModule,
    CryptoModule,
    QueueModule,
    ExecutionModule,
  ],
})
export class WorkerModule {}
