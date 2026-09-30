import { BaseEntity } from '@common/base/base.entity';

export class TransactionStepLogEntity extends BaseEntity {
  transactionId: string;
  step: string;
  direction: string;
  httpStatus?: number | null;
  durationMs?: number | null;
  requestPayload?: Record<string, any> | null;
  responsePayload?: Record<string, any> | null;
  loggedAt: Date;
}
