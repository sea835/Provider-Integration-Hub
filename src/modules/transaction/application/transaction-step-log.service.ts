import { Injectable, Inject } from '@nestjs/common';
import { BaseService } from '@common/base/base.service';
import { TransactionStepLogEntity } from '../domain/transaction-step-log.entity';
import { TransactionStepLogRepositoryPort } from '../domain/transaction-step-log.repository.port';

export interface LogStepParams {
  transactionId: string;
  step: string;
  direction: string;
  httpStatus?: number | null;
  durationMs?: number | null;
  requestPayload?: Record<string, any> | null;
  responsePayload?: Record<string, any> | null;
}

@Injectable()
export class TransactionStepLogService extends BaseService<TransactionStepLogEntity> {
  constructor(
    @Inject(TransactionStepLogRepositoryPort)
    private readonly stepLogRepository: TransactionStepLogRepositoryPort,
  ) {
    super(stepLogRepository);
  }

  async logStep(params: LogStepParams): Promise<TransactionStepLogEntity> {
    return this.stepLogRepository.create({
      transactionId: params.transactionId,
      step: params.step,
      direction: params.direction,
      httpStatus: params.httpStatus ?? null,
      durationMs: params.durationMs ?? null,
      requestPayload: params.requestPayload ?? null,
      responsePayload: params.responsePayload ?? null,
      loggedAt: new Date(),
    });
  }

  async getLogsByTransactionId(
    transactionId: string,
  ): Promise<TransactionStepLogEntity[]> {
    return this.stepLogRepository.findByTransactionId(transactionId);
  }
}
