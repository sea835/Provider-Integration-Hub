import {
  Inject,
  Injectable,
  NotFoundException,
  Logger,
  Optional,
} from '@nestjs/common';
import { BaseService } from '@common/base/base.service';
import { TransactionEntity } from '../domain/transaction.entity';
import { TransactionRepositoryPort } from '../domain/transaction.repository.port';
import { CreateOrderDto } from '../presentation/dto/create-order.dto';
import { TransactionResponseDto } from '../presentation/dto/transaction.response.dto';
import { ProviderAdapterRegistry } from '@modules/provider-adapter/application/provider-adapter.registry';
import { CatalogService } from '@modules/catalog/application/catalog.service';
import { StandardStatusResult } from '@modules/provider-adapter/domain/dtos/standard-results.dto';
import { TransactionStepLogService } from './transaction-step-log.service';
import { TransactionJobService } from './transaction-job.service';
import { TransactionStepLogEntity } from '../domain/transaction-step-log.entity';
import { TransactionJobEntity } from '../domain/transaction-job.entity';
import { uuidv7 } from 'uuidv7';

@Injectable()
export class TransactionService extends BaseService<TransactionEntity> {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    @Inject(TransactionRepositoryPort)
    private readonly transactionRepository: TransactionRepositoryPort,
    private readonly adapterRegistry: ProviderAdapterRegistry,
    private readonly catalogService: CatalogService,
    @Optional()
    private readonly stepLogService?: TransactionStepLogService,
    @Optional()
    private readonly jobService?: TransactionJobService,
  ) {
    super(transactionRepository);
  }

  /**
   * Bước 3: Tiếp nhận và khởi tạo đơn hàng (Async Mode 2)
   * POST /engine/v1/orders
   */
  async createOrder(dto: CreateOrderDto): Promise<TransactionResponseDto> {
    // 1. Chống nạp đúp bằng requestId / partnerTransId (Idempotency)
    const existing = await this.transactionRepository.findByPartnerTransId(
      dto.requestId,
    );
    if (existing) {
      this.logger.warn(
        `Duplicate order request detected for requestId: ${dto.requestId}. Returning existing transaction.`,
      );
      return this.toResponseDto(existing);
    }

    // 2. Tìm thông tin gói cước và nhà cung cấp (mặc định ANISIM)
    const pkg = this.catalogService.getPackageBySku(dto.packageCode);
    const providerCode = pkg?.providerCode || 'ANISIM';
    const supplierPackageId = pkg?.supplierPackageId || dto.packageCode;

    // 3. Khởi tạo mã đơn hàng duy nhất của Core Engine
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const transCode = `TX_${dateStr}_${randSuffix}`;

    // 4. Tạo bản ghi ban đầu trong SSoT (PostgreSQL)
    const newTx: Partial<TransactionEntity> = {
      id: uuidv7(),
      transCode,
      partnerTransId: dto.requestId,
      providerCode,
      packageCode: dto.packageCode,
      action: dto.action,
      targetPhone: dto.phone || null,
      serial: dto.serial || null,
      amount: pkg?.price || 0,
      costAmount: pkg?.costPrice || 0,
      status: 'PROCESSING',
      metadata: dto.metadata || null,
    };

    const savedTx = await this.transactionRepository.create(newTx);

    // 4.1. Ghi log bước tiếp nhận đơn hàng (INBOUND_STORE)
    if (this.stepLogService) {
      try {
        await this.stepLogService.logStep({
          transactionId: savedTx.id,
          step: 'RECEIVE_STORE_ORDER',
          direction: 'INBOUND_STORE',
          httpStatus: 201,
          requestPayload: dto,
        });
      } catch (logErr) {
        this.logger.warn(`Failed to log RECEIVE_STORE_ORDER step: ${logErr}`);
      }
    }

    // 4.2. Khởi tạo transaction job theo dõi tiến trình
    if (this.jobService) {
      try {
        await this.jobService.create({
          transactionId: savedTx.id,
          queueName: 'engine-order-execution',
          jobId: `job_${transCode}`,
          executionMode: 'ASYNC_CALLBACK',
          attemptCount: 1,
          maxAttempts: 5,
          status: 'PROCESSING',
        });
      } catch (jobErr) {
        this.logger.warn(`Failed to initialize transaction job: ${jobErr}`);
      }
    }

    // 5. Gọi Adapter NCC (ANI SIM)
    const startTime = Date.now();
    try {
      const adapter = this.adapterRegistry.get(providerCode);
      const adapterResult = await adapter.createOrder(dto, {
        packagePlanId: supplierPackageId,
        packagePlan: pkg,
      });

      const durationMs = Date.now() - startTime;

      // 5.1. Ghi step log gọi NCC (OUTBOUND_NCC)
      if (this.stepLogService) {
        try {
          await this.stepLogService.logStep({
            transactionId: savedTx.id,
            step: 'CALL_PROVIDER_ADAPTER',
            direction: 'OUTBOUND_NCC',
            httpStatus: 200,
            durationMs,
            requestPayload: { dto, packagePlanId: supplierPackageId },
            responsePayload: adapterResult,
          });
        } catch (logErr) {
          this.logger.warn(
            `Failed to log CALL_PROVIDER_ADAPTER step: ${logErr}`,
          );
        }
      }

      // 5.2. Cập nhật transaction job
      if (this.jobService) {
        try {
          const jobs = await this.jobService.getJobsByTransactionId(savedTx.id);
          if (jobs[0]) {
            await this.jobService.update(jobs[0].id, {
              totalDurationMs: durationMs,
              lastRawResponse: adapterResult,
              status: adapterResult.status,
            });
          }
        } catch (jobErr) {
          this.logger.warn(`Failed to update transaction job: ${jobErr}`);
        }
      }

      const updatedData: Partial<TransactionEntity> = {
        supplierTransId: adapterResult.supplierTransId || null,
        status: adapterResult.status,
      };

      if (adapterResult.status === 'FAILED') {
        updatedData.errorMessage =
          adapterResult.message || 'Supplier rejected order';
      }

      const updatedTx = await this.transactionRepository.update(
        savedTx.id,
        updatedData,
      );
      return this.toResponseDto(updatedTx || savedTx);
    } catch (error: unknown) {
      const durationMs = Date.now() - startTime;
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error delegating order to adapter ${providerCode}: ${msg}`,
      );

      // Ghi step log lỗi
      if (this.stepLogService) {
        try {
          await this.stepLogService.logStep({
            transactionId: savedTx.id,
            step: 'CALL_PROVIDER_ADAPTER_ERROR',
            direction: 'OUTBOUND_NCC',
            httpStatus: 500,
            durationMs,
            responsePayload: { error: msg },
          });
        } catch (logErr) {
          this.logger.warn(`Failed to log adapter error step: ${logErr}`);
        }
      }

      const updatedTx = await this.transactionRepository.update(savedTx.id, {
        status: 'FAILED',
        errorMessage: msg,
      });
      return this.toResponseDto(updatedTx || savedTx);
    }
  }

  /**
   * Bước 4: Tra cứu trạng thái đơn hàng theo mã nội bộ (< 5ms)
   * GET /engine/v1/orders/:transCode
   */
  async getOrderByTransCode(
    transCode: string,
  ): Promise<TransactionResponseDto> {
    const tx = await this.transactionRepository.findByTransCode(transCode);
    if (!tx) {
      throw new NotFoundException(
        `Order with transCode [${transCode}] not found`,
      );
    }
    return this.toResponseDto(tx);
  }

  /**
   * Cập nhật kết quả đơn hàng từ Webhook Callback hoặc Polling Worker
   */
  async handleWebhookResult(
    result: StandardStatusResult,
  ): Promise<TransactionEntity | null> {
    this.logger.log(
      `Processing status update: supplierTransId=${result.supplierTransId}, requestId=${result.requestId}, status=${result.status}`,
    );

    let tx: TransactionEntity | null = null;
    if (result.supplierTransId) {
      tx = await this.transactionRepository.findBySupplierTransId(
        result.supplierTransId,
      );
    }
    if (!tx && result.requestId) {
      tx = await this.transactionRepository.findByPartnerTransId(
        result.requestId,
      );
    }

    if (!tx) {
      this.logger.warn(
        `No transaction found for supplierTransId: ${result.supplierTransId} or requestId: ${result.requestId}`,
      );
      return null;
    }

    // Ghi step log callback nhận được
    if (this.stepLogService) {
      try {
        await this.stepLogService.logStep({
          transactionId: tx.id,
          step: 'RECEIVE_SUPPLIER_CALLBACK',
          direction: 'INBOUND_CALLBACK',
          httpStatus: 200,
          responsePayload: result,
        });
      } catch (logErr) {
        this.logger.warn(`Failed to log callback step: ${logErr}`);
      }
    }

    // Cập nhật transaction job
    if (this.jobService) {
      try {
        const jobs = await this.jobService.getJobsByTransactionId(tx.id);
        if (jobs[0]) {
          await this.jobService.update(jobs[0].id, {
            status: result.status,
            lastRawResponse: result,
          });
        }
      } catch (jobErr) {
        this.logger.warn(`Failed to update job from callback: ${jobErr}`);
      }
    }

    // Cập nhật trạng thái và các dữ liệu liên quan (SIM, eSIM LPA/QR)
    const updatePayload: Partial<TransactionEntity> = {
      status: result.status,
      completedAt: result.status === 'COMPLETED' ? new Date() : tx.completedAt,
    };

    if (result.costAmount) updatePayload.costAmount = result.costAmount;
    if (result.msisdn) updatePayload.targetPhone = result.msisdn;
    if (result.serial) updatePayload.serial = result.serial;
    if (result.lpaString) updatePayload.lpaString = result.lpaString;
    if (result.qrUrl) updatePayload.qrUrl = result.qrUrl;
    if (result.errorCode) updatePayload.errorCode = result.errorCode;
    if (result.errorMessage) updatePayload.errorMessage = result.errorMessage;

    return this.transactionRepository.update(tx.id, updatePayload);
  }

  /**
   * Polling thủ công kiểm tra trạng thái với NCC
   */
  async pollOrderStatus(transCode: string): Promise<TransactionResponseDto> {
    const tx = await this.transactionRepository.findByTransCode(transCode);
    if (!tx) {
      throw new NotFoundException(
        `Order with transCode [${transCode}] not found`,
      );
    }

    if (tx.status === 'COMPLETED' || tx.status === 'FAILED') {
      return this.toResponseDto(tx);
    }

    const startTime = Date.now();
    const adapter = this.adapterRegistry.get(tx.providerCode);
    const pollResult = await adapter.queryOrderStatus(
      tx.supplierTransId || '',
      tx.partnerTransId,
    );
    const durationMs = Date.now() - startTime;

    // Ghi step log polling
    if (this.stepLogService) {
      try {
        await this.stepLogService.logStep({
          transactionId: tx.id,
          step: 'POLL_PROVIDER_STATUS',
          direction: 'OUTBOUND_NCC',
          httpStatus: 200,
          durationMs,
          requestPayload: {
            supplierTransId: tx.supplierTransId,
            partnerTransId: tx.partnerTransId,
          },
          responsePayload: pollResult,
        });
      } catch (logErr) {
        this.logger.warn(`Failed to log poll step: ${logErr}`);
      }
    }

    // Cập nhật transaction job poll attempt
    if (this.jobService) {
      try {
        const jobs = await this.jobService.getJobsByTransactionId(tx.id);
        if (jobs[0]) {
          await this.jobService.recordPollAttempt(jobs[0].id, pollResult, {
            durationMs,
            status: pollResult.status,
          });
        }
      } catch (jobErr) {
        this.logger.warn(`Failed to record poll attempt in job: ${jobErr}`);
      }
    }

    const updated = await this.handleWebhookResult(pollResult);
    return this.toResponseDto(updated || tx);
  }

  /**
   * Lấy lịch sử các bước thực thi (Step Logs) của một đơn hàng
   */
  async getOrderLogs(transCode: string): Promise<TransactionStepLogEntity[]> {
    const tx = await this.transactionRepository.findByTransCode(transCode);
    if (!tx) {
      throw new NotFoundException(
        `Order with transCode [${transCode}] not found`,
      );
    }
    if (!this.stepLogService) return [];
    return this.stepLogService.getLogsByTransactionId(tx.id);
  }

  /**
   * Lấy lịch sử các jobs/worker theo dõi của một đơn hàng
   */
  async getOrderJobs(transCode: string): Promise<TransactionJobEntity[]> {
    const tx = await this.transactionRepository.findByTransCode(transCode);
    if (!tx) {
      throw new NotFoundException(
        `Order with transCode [${transCode}] not found`,
      );
    }
    if (!this.jobService) return [];
    return this.jobService.getJobsByTransactionId(tx.id);
  }

  private toResponseDto(tx: TransactionEntity): TransactionResponseDto {
    return {
      transCode: tx.transCode,
      requestId: tx.partnerTransId,
      supplierTransId: tx.supplierTransId,
      providerCode: tx.providerCode,
      packageCode: tx.packageCode,
      action: tx.action,
      status: tx.status,
      phone: tx.targetPhone,
      serial: tx.serial,
      amount: Number(tx.amount || 0),
      costAmount: tx.costAmount ? Number(tx.costAmount) : null,
      lpaString: tx.lpaString,
      qrUrl: tx.qrUrl,
      errorCode: tx.errorCode,
      errorMessage: tx.errorMessage,
      createdAt: tx.createdAt,
      completedAt: tx.completedAt,
    };
  }
}
