import { TransactionJobService } from './transaction-job.service';
import { TransactionJobRepositoryPort } from '../domain/transaction-job.repository.port';
import { NotFoundException } from '@nestjs/common';

describe('TransactionJobService', () => {
  let service: TransactionJobService;
  let mockRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    mockRepo = {
      findByTransactionId: jest.fn(),
      findByJobId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn(),
      findPaginated: jest.fn(),
      delete: jest.fn(),
    };

    service = new TransactionJobService(
      mockRepo as unknown as TransactionJobRepositoryPort,
    );
  });

  it('should find jobs by transactionId', async () => {
    mockRepo.findByTransactionId.mockResolvedValue([
      { id: 'job-1', queueName: 'engine-queue' },
    ]);

    const jobs = await service.getJobsByTransactionId('tx-123');
    expect(jobs).toHaveLength(1);
    expect(mockRepo.findByTransactionId).toHaveBeenCalledWith('tx-123');
  });

  it('should get job by jobId', async () => {
    mockRepo.findByJobId.mockResolvedValue({
      id: 'job-1',
      jobId: 'job_TX_123',
    });

    const job = await service.getByJobId('job_TX_123');
    expect(job.id).toBe('job-1');
  });

  it('should throw NotFoundException when jobId not found', async () => {
    mockRepo.findByJobId.mockResolvedValue(null);

    await expect(service.getByJobId('unknown_job')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should record poll attempt and increment attemptCount', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'job-1',
      attemptCount: 1,
      totalDurationMs: 100,
      status: 'PROCESSING',
    });
    mockRepo.update.mockImplementation(
      (id: string, data: Record<string, unknown>) =>
        Promise.resolve({ id, ...data }),
    );

    const updated = await service.recordPollAttempt(
      'job-1',
      { status: 'PROCESSING', delay: 5 },
      { durationMs: 50 },
    );

    expect(updated.attemptCount).toBe(2);
    expect(updated.totalDurationMs).toBe(150);
    expect(updated.lastPolledAt).toBeDefined();
    expect(mockRepo.update).toHaveBeenCalled();
  });
});
