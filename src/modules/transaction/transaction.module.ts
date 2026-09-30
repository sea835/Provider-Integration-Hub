import { Module } from '@nestjs/common';
import { TransactionController } from './presentation/transaction.controller';
import { WebhookCallbackController } from './presentation/webhook-callback.controller';
import { TransactionService } from './application/transaction.service';
import { TransactionRepository } from './infrastructure/transaction.repository';
import { TransactionRepositoryPort } from './domain/transaction.repository.port';
import { ProviderAdapterModule } from '@modules/provider-adapter/provider-adapter.module';
import { CatalogModule } from '@modules/catalog/catalog.module';
import { DrizzleModule } from '@infrastructure/database/drizzle.module';
import { TransactionJobService } from './application/transaction-job.service';
import { TransactionJobRepository } from './infrastructure/transaction-job.repository';
import { TransactionJobRepositoryPort } from './domain/transaction-job.repository.port';
import { TransactionStepLogService } from './application/transaction-step-log.service';
import { TransactionStepLogRepository } from './infrastructure/transaction-step-log.repository';
import { TransactionStepLogRepositoryPort } from './domain/transaction-step-log.repository.port';

@Module({
  imports: [DrizzleModule, ProviderAdapterModule, CatalogModule],
  controllers: [TransactionController, WebhookCallbackController],
  providers: [
    TransactionService,
    TransactionJobService,
    TransactionStepLogService,
    {
      provide: TransactionRepositoryPort,
      useClass: TransactionRepository,
    },
    {
      provide: TransactionJobRepositoryPort,
      useClass: TransactionJobRepository,
    },
    {
      provide: TransactionStepLogRepositoryPort,
      useClass: TransactionStepLogRepository,
    },
  ],
  exports: [
    TransactionService,
    TransactionJobService,
    TransactionStepLogService,
    TransactionRepositoryPort,
    TransactionJobRepositoryPort,
    TransactionStepLogRepositoryPort,
  ],
})
export class TransactionModule {}
