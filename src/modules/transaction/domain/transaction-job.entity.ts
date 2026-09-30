import { BaseEntity } from '@common/base/base.entity';

export class TransactionJobEntity extends BaseEntity {
  transactionId: string;
  queueName: string;
  jobId: string;
  executionMode: string;
  attemptCount: number;
  maxAttempts: number;
  totalDurationMs?: number | null;
  nextPollAt?: Date | null;
  lastPolledAt?: Date | null;
  lastRawResponse?: Record<string, any> | null;
}
