import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { BaseService } from '@common/base/base.service';
import { TransactionJobEntity } from '../domain/transaction-job.entity';
import { TransactionJobRepositoryPort } from '../domain/transaction-job.repository.port';

@Injectable()
export class TransactionJobService extends BaseService<TransactionJobEntity> {
  constructor(
    @Inject(TransactionJobRepositoryPort)
    private readonly transactionJobRepository: TransactionJobRepositoryPort,
  ) {
    super(transactionJobRepository);
  }

  async getJobsByTransactionId(
    transactionId: string,
  ): Promise<TransactionJobEntity[]> {
    return this.transactionJobRepository.findByTransactionId(transactionId);
  }

  async getByJobId(jobId: string): Promise<TransactionJobEntity> {
    const job = await this.transactionJobRepository.findByJobId(jobId);
    if (!job) {
      throw new NotFoundException(
        `Transaction job with jobId [${jobId}] not found`,
      );
    }
    return job;
  }

  async recordPollAttempt(
    id: string,
    rawResponse: Record<string, any>,
    options?: {
      nextPollAt?: Date | null;
      status?: string;
      durationMs?: number;
    },
  ): Promise<TransactionJobEntity> {
    const existing = await this.findOne(id);
    const updated = await this.transactionJobRepository.update(id, {
      attemptCount: (existing.attemptCount || 0) + 1,
      lastPolledAt: new Date(),
      lastRawResponse: rawResponse,
      nextPollAt: options?.nextPollAt,
      status: options?.status || existing.status,
      totalDurationMs: options?.durationMs
        ? (existing.totalDurationMs || 0) + options.durationMs
        : existing.totalDurationMs,
    });
    if (!updated) {
      throw new NotFoundException(`Failed to update transaction job [${id}]`);
    }
    return updated;
  }
}
