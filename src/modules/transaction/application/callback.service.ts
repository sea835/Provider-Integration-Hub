import { Inject, Injectable } from '@nestjs/common';
import { LoggerPort, LogLayer } from '@common/logger';
import { maskSensitive } from '@common/libs/mask-sensitive';
import { normalizeIp } from '@common/libs/normalize-ip';
import { SupplierConfigService } from '@modules/supplier/application/supplier-config.service';
import { AdapterRegistry } from '@modules/provider-adapter/application/adapter-registry';
import { RawCallback } from '@modules/provider-adapter/domain/provider-adapter.port';
import {
  CallbackEventRepositoryPort,
  TransactionRepositoryPort,
} from '@modules/transaction/domain/transaction.repository.port';
import { EventSource } from '@modules/transaction/domain/transaction-event';
import {
  CallbackForbiddenError,
  CallbackNotSupportedError,
} from '@modules/transaction/domain/transaction.errors';
import { OrderStateService } from '@modules/transaction/application/order-state.service';

export interface CallbackOutcome {
  duplicate: boolean;
  matched: boolean;
}

/** G6: nhận callback NCC, chống trùng theo eventId, cập nhật đơn qua OrderStateService. */
@Injectable()
export class CallbackService {
  private readonly logger: LoggerPort;

  constructor(
    private readonly configs: SupplierConfigService,
    private readonly adapters: AdapterRegistry,
    @Inject(CallbackEventRepositoryPort)
    private readonly callbacks: CallbackEventRepositoryPort,
    @Inject(TransactionRepositoryPort)
    private readonly orders: TransactionRepositoryPort,
    private readonly state: OrderStateService,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.APPLICATION,
      'Transaction',
      CallbackService.name,
    );
  }

  async handle(
    supplierCode: string,
    raw: RawCallback,
  ): Promise<CallbackOutcome> {
    const config = await this.configs.getByCode(supplierCode);
    const adapter = this.adapters.get(config.adapterType);
    if (!adapter.capabilities.callback || !adapter.parseCallback) {
      throw new CallbackNotSupportedError(supplierCode);
    }

    const ctx = this.configs.toContext(config);
    const ip = normalizeIp(raw.ip);
    const verified = adapter.verifyCallback
      ? await adapter.verifyCallback(ctx, raw)
      : config.callbackIpWhitelist.length > 0 &&
        config.callbackIpWhitelist.includes(ip);
    if (!verified) {
      this.logger.warn('Từ chối callback', { supplier: supplierCode, ip });
      throw new CallbackForbiddenError(ip);
    }

    const parsed = await adapter.parseCallback(ctx, raw);
    const stored = await this.callbacks.insertIfAbsent({
      supplierId: config.id,
      eventId: parsed.eventId,
      payload: maskSensitive(raw.body) ?? {},
    });
    if (!stored) {
      this.logger.info('Bỏ qua callback trùng', {
        supplier: supplierCode,
        eventId: parsed.eventId,
      });
      return { duplicate: true, matched: false };
    }

    const order = parsed.transCode
      ? await this.orders.findByTransCode(parsed.transCode)
      : parsed.supplierTransId
        ? await this.orders.findBySupplierTrans(
            config.id,
            parsed.supplierTransId,
          )
        : null;

    if (!order || order.supplierId !== config.id) {
      this.logger.warn('Callback không khớp đơn nào', {
        supplier: supplierCode,
        eventId: parsed.eventId,
        transCode: parsed.transCode,
      });
      return { duplicate: false, matched: false };
    }

    await this.state.applyResult(
      order.transCode,
      parsed.result,
      EventSource.CALLBACK,
    );
    await this.callbacks.markMatched(stored.id, order.id);
    return { duplicate: false, matched: true };
  }
}
