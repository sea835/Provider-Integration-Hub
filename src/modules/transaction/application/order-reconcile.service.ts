import { Injectable } from '@nestjs/common';
import { LoggerPort, LogLayer } from '@common/logger';
import { AdapterRegistry } from '@modules/provider-adapter/application/adapter-registry';
import {
  OrderDelivery,
  OutcomeType,
  SupplierResult,
  unknownResult,
} from '@modules/provider-adapter/domain/supplier-result';
import { SupplierConfigService } from '@modules/supplier/application/supplier-config.service';
import { OrderQueryService } from '@modules/transaction/application/order-query.service';

export interface OrderLookupOutput {
  transCode: string;
  supplierCode: string;
  outcome: OutcomeType;
  supplierTransId: string | null;
  delivery: OrderDelivery | null;
  error: { code: string; message: string } | null;
  httpStatus: number | null;
  durationMs: number;
  request: unknown;
  response: unknown;
  checkedAt: string;
}

/**
 * Đối soát thủ công: hỏi NCC ngay bằng đúng API tra cứu của NCC (kể cả khi NCC đang tạm dừng
 * hay đơn đã chuyển đối soát). Chỉ đọc, không đổi trạng thái đơn; vận hành xem rồi tự chốt.
 */
@Injectable()
export class OrderReconcileService {
  private readonly logger: LoggerPort;

  constructor(
    private readonly orders: OrderQueryService,
    private readonly configs: SupplierConfigService,
    private readonly adapters: AdapterRegistry,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.APPLICATION,
      'Transaction',
      OrderReconcileService.name,
    );
  }

  async lookup(transCode: string): Promise<OrderLookupOutput> {
    const order = await this.orders.getByTransCode(transCode);
    const config = await this.configs.getById(order.supplierId);
    const adapter = this.adapters.get(config.adapterType);
    const startedAt = Date.now();
    let result: SupplierResult;
    try {
      result = await adapter.query(this.configs.toContext(config), {
        transCode,
        supplierTransId: order.supplierTransId,
      });
    } catch (error) {
      result = unknownResult(
        `Adapter lỗi: ${error instanceof Error ? error.message : String(error)}`,
        { durationMs: Date.now() - startedAt },
        'ADAPTER_ERROR',
      );
    }
    this.logger.info('Đối soát thủ công với NCC', {
      transCode,
      supplier: config.code,
      outcome: result.outcome,
    });
    return {
      transCode,
      supplierCode: config.code,
      outcome: result.outcome,
      supplierTransId: result.supplierTransId ?? null,
      delivery: result.delivery ?? null,
      error: result.error
        ? { code: result.error.code, message: result.error.message }
        : null,
      httpStatus: result.trace.httpStatus ?? null,
      durationMs: result.trace.durationMs,
      request: result.trace.request ?? null,
      response: result.trace.response ?? null,
      checkedAt: new Date().toISOString(),
    };
  }
}
