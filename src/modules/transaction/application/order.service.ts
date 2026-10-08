import { Inject, Injectable } from '@nestjs/common';
import { LoggerPort, LogLayer } from '@common/logger';
import { TransactionRunnerPort } from '@common/database/transaction-runner.port';
import { DomainError } from '@common/errors/domain-error';
import { AuthenticatedMerchant } from '@modules/merchant/domain/merchant.entity';
import { OrderActionType } from '@modules/provider-adapter/domain/order-action';
import {
  ActionFieldRules,
  defaultFieldRules,
  OrderExtraField,
} from '@modules/provider-adapter/domain/order-fields';
import { AdapterRegistry } from '@modules/provider-adapter/application/adapter-registry';
import { SupplierConfigService } from '@modules/supplier/application/supplier-config.service';
import { SupplierConfig } from '@modules/supplier/domain/supplier-config';
import { SupplierStatus } from '@modules/supplier/domain/supplier-status';
import { TransactionEntity } from '@modules/transaction/domain/transaction.entity';
import {
  TransactionEventRepositoryPort,
  TransactionRepositoryPort,
} from '@modules/transaction/domain/transaction.repository.port';
import { TransactionStatus } from '@modules/transaction/domain/transaction-status';
import {
  EventSource,
  EventType,
} from '@modules/transaction/domain/transaction-event';
import {
  ActionNotSupportedError,
  DuplicateRequestIdError,
  InvalidOrderRequestError,
  SupplierUnavailableError,
} from '@modules/transaction/domain/transaction.errors';
import { resolveOrderFields } from '@modules/transaction/domain/order-fields.policy';
import { resolveOrderExtra } from '@modules/transaction/domain/order-extra.policy';
import { OrderQueuePort } from '@modules/transaction/domain/order-queue.port';
import {
  hashOrderRequest,
  newTransCode,
} from '@modules/transaction/application/order-identity';

const MAX_METADATA_BYTES = 2048;

export interface AcceptOrderInput {
  requestId: string;
  supplierCode: string;
  action: OrderActionType;
  packageCode: string;
  phone?: string | null;
  serial?: string | null;
  extra?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface SupplierOrderRules {
  fields: ActionFieldRules;
  /** null: chưa đọc được NCC, để lỗi NCC hiện ra thay vì lỗi trường thêm. */
  extra: OrderExtraField[] | null;
}

export interface AcceptOrderResult {
  created: boolean;
  order: TransactionEntity;
}

/**
 * G2: tiếp nhận đơn từ Store. Không gọi NCC.
 * Một DB transaction: chống trùng requestId + lưu đơn + event,
 * enqueue SUBMIT sau khi commit (lỗi enqueue thì Sweeper vớt).
 */
@Injectable()
export class OrderService {
  private readonly logger: LoggerPort;

  constructor(
    @Inject(TransactionRepositoryPort)
    private readonly orders: TransactionRepositoryPort,
    @Inject(TransactionEventRepositoryPort)
    private readonly events: TransactionEventRepositoryPort,
    private readonly suppliers: SupplierConfigService,
    private readonly adapters: AdapterRegistry,
    private readonly queue: OrderQueuePort,
    private readonly runner: TransactionRunnerPort,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.APPLICATION,
      'Transaction',
      OrderService.name,
    );
  }

  async accept(
    merchant: AuthenticatedMerchant,
    input: AcceptOrderInput,
  ): Promise<AcceptOrderResult> {
    if (
      input.metadata &&
      Buffer.byteLength(JSON.stringify(input.metadata)) > MAX_METADATA_BYTES
    ) {
      throw new InvalidOrderRequestError('metadata tối đa 2KB');
    }

    const supplierCode = input.supplierCode.trim().toUpperCase();
    const rules = await this.orderRulesOf(supplierCode, input.action);
    const fields = resolveOrderFields(input, rules.fields);
    const extra = rules.extra
      ? resolveOrderExtra(input.action, input.extra, rules.extra)
      : {};
    const packageCode = input.packageCode.trim();
    const requestHash = hashOrderRequest({
      action: input.action,
      supplierCode,
      packageCode,
      phone: fields.phone,
      serial: fields.serial,
      extra,
    });

    const result = await this.runner.run(async () => {
      const existing = await this.orders.findByMerchantRequest(
        merchant.id,
        input.requestId,
      );
      if (existing) return this.asDuplicate(existing, requestHash, input);

      const supplier = await this.activeSupplier(supplierCode);
      const adapter = this.adapters.get(supplier.adapterType);
      const actions: string[] = adapter.supportedActions
        ? adapter.supportedActions(this.suppliers.toContext(supplier))
        : adapter.capabilities.actions;
      if (!actions.includes(input.action)) {
        throw new ActionNotSupportedError(supplier.code, input.action);
      }

      const inserted = await this.orders.insertIfAbsent({
        status: TransactionStatus.PENDING,
        transCode: newTransCode(),
        merchantId: merchant.id,
        partnerTransId: input.requestId,
        requestHash,
        action: input.action,
        supplierId: supplier.id,
        supplierCode: supplier.code,
        packageCode,
        configVersion: supplier.version,
        phone: fields.phone,
        serial: fields.serial,
        extra,
        metadata: input.metadata ?? null,
      });

      if (!inserted) {
        const concurrent = await this.orders.findByMerchantRequest(
          merchant.id,
          input.requestId,
        );
        return this.asDuplicate(concurrent!, requestHash, input);
      }

      await this.events.record({
        transactionId: inserted.id,
        source: EventSource.API,
        type: EventType.ACCEPTED,
        toStatus: inserted.status,
        configVersion: inserted.configVersion,
        request: {
          requestId: input.requestId,
          supplierCode,
          packageCode,
          action: input.action,
        },
      });
      return { created: true, order: inserted };
    });

    if (result.created) {
      await this.enqueueSubmit(result.order);
      this.logger.info('Tiếp nhận đơn', {
        transCode: result.order.transCode,
        merchant: merchant.code,
        supplier: result.order.supplierCode,
        packageCode: result.order.packageCode,
      });
    }
    return result;
  }

  /**
   * Luật trường của NCC cho thao tác này. Không đọc được NCC thì không bắt buộc gì,
   * để lỗi "NCC không tồn tại / tạm dừng" hiện ra thay vì lỗi thiếu trường.
   */
  private async orderRulesOf(
    supplierCode: string,
    action: OrderActionType,
  ): Promise<SupplierOrderRules> {
    try {
      const supplier = await this.suppliers.getByCode(supplierCode);
      const adapter = this.adapters.get(supplier.adapterType);
      const ctx = this.suppliers.toContext(supplier);
      const rules = adapter.fieldRules
        ? adapter.fieldRules(ctx)
        : defaultFieldRules();
      return {
        fields: rules[action],
        extra: adapter.extraFields ? adapter.extraFields(ctx) : [],
      };
    } catch (error) {
      if (error instanceof DomainError) {
        return {
          fields: { phone: 'OPTIONAL', serial: 'OPTIONAL' },
          extra: null,
        };
      }
      throw error;
    }
  }

  private async activeSupplier(code: string): Promise<SupplierConfig> {
    let supplier: SupplierConfig;
    try {
      supplier = await this.suppliers.getByCode(code);
    } catch (error) {
      if (error instanceof DomainError)
        throw new SupplierUnavailableError(code);
      throw error;
    }
    if (supplier.status !== SupplierStatus.ACTIVE) {
      throw new SupplierUnavailableError(code);
    }
    return supplier;
  }

  private asDuplicate(
    existing: TransactionEntity,
    requestHash: string,
    input: AcceptOrderInput,
  ): AcceptOrderResult {
    if (existing.requestHash !== requestHash) {
      throw new DuplicateRequestIdError(input.requestId);
    }
    return { created: false, order: existing };
  }

  private async enqueueSubmit(order: TransactionEntity): Promise<void> {
    try {
      await this.queue.enqueueSubmit(
        order.supplierCode,
        order.transCode,
        order.submitCount + 1,
      );
    } catch (error) {
      this.logger.error('Không enqueue được SUBMIT, Sweeper sẽ xử lý', error, {
        transCode: order.transCode,
      });
    }
  }
}
