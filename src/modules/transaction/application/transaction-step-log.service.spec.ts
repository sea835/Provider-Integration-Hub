import { TransactionStepLogService } from './transaction-step-log.service';
import { TransactionStepLogRepositoryPort } from '../domain/transaction-step-log.repository.port';

describe('TransactionStepLogService', () => {
  let service: TransactionStepLogService;
  let mockRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    mockRepo = {
      findByTransactionId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn(),
      findPaginated: jest.fn(),
      delete: jest.fn(),
    };

    service = new TransactionStepLogService(
      mockRepo as unknown as TransactionStepLogRepositoryPort,
    );
  });

  it('should log a step with correct payload and direction', async () => {
    mockRepo.create.mockImplementation((data) =>
      Promise.resolve({ id: 'log-1', ...data }),
    );

    const log = await service.logStep({
      transactionId: 'tx-123',
      step: 'RECEIVE_STORE_ORDER',
      direction: 'INBOUND_STORE',
      httpStatus: 201,
      durationMs: 15,
      requestPayload: { phone: '0914780285' },
    });

    expect(log.transactionId).toBe('tx-123');
    expect(log.step).toBe('RECEIVE_STORE_ORDER');
    expect(log.direction).toBe('INBOUND_STORE');
    expect(log.httpStatus).toBe(201);
    expect(mockRepo.create).toHaveBeenCalled();
  });

  it('should retrieve logs by transactionId', async () => {
    mockRepo.findByTransactionId.mockResolvedValue([
      { id: 'log-1', step: 'STEP_1' },
      { id: 'log-2', step: 'STEP_2' },
    ]);

    const logs = await service.getLogsByTransactionId('tx-123');
    expect(logs).toHaveLength(2);
    expect(mockRepo.findByTransactionId).toHaveBeenCalledWith('tx-123');
  });
});
