import { Inject, Injectable } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { LoggerPort, LogLayer } from '@common/logger';
import { DomainError, DomainErrorKind } from '@common/errors/domain-error';
import { MerchantService } from '@modules/merchant/application/merchant.service';
import { MerchantCallbackNotReadyError } from '@modules/merchant/domain/merchant.errors';
import { TransactionRepositoryPort } from '@modules/transaction/domain/transaction.repository.port';
import { OrderQueryService } from '@modules/transaction/application/order-query.service';
import {
  StoreCallbackEntity,
  StoreCallbackFilter,
  StoreCallbackRepositoryPort,
  StoreCallbackStatus,
} from '@modules/transaction/domain/store-callback';
import { OrderResponse } from '@modules/transaction/presentation/dto/order.response';
import {
  SendResult,
  StoreCallbackSender,
} from '@modules/store-callback/application/store-callback-sender';

/** Giãn cách giữa các lần gửi lại (giây); hết lịch thì FAILED, chờ vận hành bấm gửi lại. */
export const STORE_CALLBACK_RETRY_SEC = [
  10, 30, 60, 300, 900, 1800, 3600, 7200, 14400, 21600,
];
export const STORE_CALLBACK_MAX_ATTEMPTS = STORE_CALLBACK_RETRY_SEC.length + 1;

export class StoreCallbackNotFoundError extends DomainError {
  readonly code = 'ERR_STORE_CALLBACK_NOT_FOUND';
  readonly kind = DomainErrorKind.NOT_FOUND;

  constructor(id: string) {
    super(`Không tìm thấy callback ${id}`);
  }
}

export interface CallbackTestResult extends SendResult {
  url: string;
  eventId: string;
}

@Injectable()
export class StoreCallbackService {
  private readonly logger: LoggerPort;

  constructor(
    @Inject(StoreCallbackRepositoryPort)
    private readonly callbacks: StoreCallbackRepositoryPort,
    @Inject(TransactionRepositoryPort)
    private readonly orders: TransactionRepositoryPort,
    private readonly orderQuery: OrderQueryService,
    private readonly merchants: MerchantService,
    private readonly sender: StoreCallbackSender,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.APPLICATION,
      'StoreCallback',
      StoreCallbackService.name,
    );
  }

  /** Gửi một bản ghi outbox đã được nhận (claim). */
  async deliver(callback: StoreCallbackEntity): Promise<void> {
    const attempts = callback.attempts + 1;
    const config = await this.merchants.callbackConfig(callback.merchantId);
    if (!config.enabled || !config.url || !config.secret) {
      await this.callbacks.recordAttempt(callback.id, {
        attempts: callback.attempts,
        status: StoreCallbackStatus.SKIPPED,
        nextAttemptAt: null,
        url: config.url,
        httpStatus: null,
        durationMs: null,
        error: 'Store chưa bật callback (hoặc thiếu địa chỉ / khoá ký)',
        response: null,
      });
      return;
    }

    const order = await this.orders.findById(callback.transactionId);
    if (!order) {
      await this.callbacks.recordAttempt(callback.id, {
        attempts,
        status: StoreCallbackStatus.FAILED,
        nextAttemptAt: null,
        url: config.url,
        httpStatus: null,
        durationMs: null,
        error: 'Không tìm thấy đơn',
        response: null,
      });
      return;
    }

    const result = await this.sender.send(config.url, config.secret, {
      eventId: callback.id,
      event: callback.event,
      createdAt: new Date(callback.createdAt).toISOString(),
      data: OrderResponse.fromEntity(order),
    });
    const retryable = !result.ok && attempts < STORE_CALLBACK_MAX_ATTEMPTS;
    await this.callbacks.recordAttempt(callback.id, {
      attempts,
      status: result.ok
        ? StoreCallbackStatus.DELIVERED
        : retryable
          ? StoreCallbackStatus.PENDING
          : StoreCallbackStatus.FAILED,
      nextAttemptAt: retryable
        ? new Date(Date.now() + STORE_CALLBACK_RETRY_SEC[attempts - 1] * 1000)
        : null,
      url: config.url,
      httpStatus: result.httpStatus,
      durationMs: result.durationMs,
      error: result.error,
      response: result.response,
    });
    if (!result.ok) {
      this.logger.warn('Gửi callback về Store chưa thành công', {
        transCode: callback.transCode,
        attempts,
        httpStatus: result.httpStatus,
        error: result.error,
        willRetry: retryable,
      });
    }
  }

  /** Gửi thử một sự kiện `ping` bằng địa chỉ và khoá ký hiện tại (kể cả khi chưa bật). */
  async test(merchantId: string): Promise<CallbackTestResult> {
    const config = await this.merchants.callbackConfig(merchantId);
    if (!config.url) {
      throw new MerchantCallbackNotReadyError(
        'Chưa nhập địa chỉ nhận callback',
      );
    }
    if (!config.secret) {
      throw new MerchantCallbackNotReadyError('Chưa tạo khoá ký callback');
    }
    const eventId = uuidv7();
    const result = await this.sender.send(config.url, config.secret, {
      eventId,
      event: 'ping',
      createdAt: new Date().toISOString(),
      data: { message: 'Kiểm tra kết nối callback từ Hub' },
    });
    return { ...result, url: config.url, eventId };
  }

  list(filter: StoreCallbackFilter): Promise<StoreCallbackEntity[]> {
    return this.callbacks.list(filter);
  }

  async listByOrder(transCode: string): Promise<StoreCallbackEntity[]> {
    const order = await this.orderQuery.getByTransCode(transCode);
    return this.callbacks.list({ transactionId: order.id, limit: 50 });
  }

  async retry(id: string): Promise<StoreCallbackEntity> {
    const updated = await this.callbacks.requeue(id);
    if (!updated) throw new StoreCallbackNotFoundError(id);
    this.logger.info('Vận hành cho gửi lại callback', {
      id,
      transCode: updated.transCode,
    });
    return updated;
  }
}
