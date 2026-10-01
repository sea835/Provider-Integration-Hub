import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '@common/base/pagination.dto';
import { TransactionEntity } from '@modules/transaction/domain/transaction.entity';
import {
  AdminOrderFilter,
  TransactionEventRepositoryPort,
  TransactionRepositoryPort,
} from '@modules/transaction/domain/transaction.repository.port';
import { TransactionEventEntity } from '@modules/transaction/domain/transaction-event';
import { OrderNotFoundError } from '@modules/transaction/domain/transaction.errors';

@Injectable()
export class OrderQueryService {
  constructor(
    @Inject(TransactionRepositoryPort)
    private readonly orders: TransactionRepositoryPort,
    @Inject(TransactionEventRepositoryPort)
    private readonly events: TransactionEventRepositoryPort,
  ) {}

  /** Merchant chỉ thấy đơn của mình; đơn của merchant khác coi như không tồn tại. */
  async getForMerchant(
    merchantId: string,
    transCode: string,
  ): Promise<TransactionEntity> {
    const order = await this.orders.findByTransCode(transCode);
    if (!order || order.merchantId !== merchantId) {
      throw new OrderNotFoundError(transCode);
    }
    return order;
  }

  async getByRequestId(
    merchantId: string,
    requestId: string,
  ): Promise<TransactionEntity> {
    const order = await this.orders.findByMerchantRequest(
      merchantId,
      requestId,
    );
    if (!order) throw new OrderNotFoundError(requestId);
    return order;
  }

  async getByTransCode(transCode: string): Promise<TransactionEntity> {
    const order = await this.orders.findByTransCode(transCode);
    if (!order) throw new OrderNotFoundError(transCode);
    return order;
  }

  listForAdmin(
    filter: AdminOrderFilter,
  ): Promise<PaginatedResult<TransactionEntity>> {
    return this.orders.listForAdmin(filter);
  }

  async listEvents(transCode: string): Promise<TransactionEventEntity[]> {
    const order = await this.getByTransCode(transCode);
    return this.events.listByTransaction(order.id);
  }
}
