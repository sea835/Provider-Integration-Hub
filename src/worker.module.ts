import { Module } from '@nestjs/common';
import { LoggerModule } from '@infrastructure/logger/logger.module';
import { DrizzleModule } from '@infrastructure/database/drizzle.module';
import { CryptoModule } from '@infrastructure/crypto/crypto.module';
import { QueueModule } from '@infrastructure/queue/queue.module';

/** Process worker: không mở HTTP, nơi đăng ký các BullMQ worker / job định kỳ. */
@Module({
  imports: [LoggerModule, DrizzleModule, CryptoModule, QueueModule],
})
export class WorkerModule {}
