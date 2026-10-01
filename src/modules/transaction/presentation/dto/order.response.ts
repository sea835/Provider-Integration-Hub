import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionEntity } from '@modules/transaction/domain/transaction.entity';
import { TransactionEventEntity } from '@modules/transaction/domain/transaction-event';
import { TransactionStatus } from '@modules/transaction/domain/transaction-status';
import { toPublicStatus } from '@modules/transaction/domain/transaction-status.policy';
import type { OrderDelivery } from '@modules/provider-adapter/domain/supplier-result';

export class OrderErrorResponse {
  @ApiProperty() code: string;
  @ApiPropertyOptional({ nullable: true }) message: string | null;
}

/** G2/G8: đơn trả cho Store. MANUAL_REVIEW hiển thị là PROCESSING. */
export class OrderResponse {
  @ApiProperty() transCode: string;
  @ApiProperty() requestId: string;
  @ApiProperty({
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
  })
  status: string;
  @ApiProperty() supplierCode: string;
  @ApiProperty() action: string;
  @ApiProperty() packageCode: string;
  @ApiPropertyOptional({ nullable: true }) phone: string | null;
  @ApiPropertyOptional({ nullable: true }) serial: string | null;
  @ApiProperty({ type: Object }) delivery: OrderDelivery;
  @ApiPropertyOptional({ type: OrderErrorResponse, nullable: true })
  error: OrderErrorResponse | null;
  @ApiProperty() createdAt: Date;
  @ApiPropertyOptional({ nullable: true }) completedAt: Date | null;

  static fromEntity(entity: TransactionEntity): OrderResponse {
    const status = toPublicStatus(entity.status);
    return Object.assign(new OrderResponse(), {
      transCode: entity.transCode,
      requestId: entity.partnerTransId,
      status,
      supplierCode: entity.supplierCode,
      action: entity.action,
      packageCode: entity.packageCode,
      phone: entity.phone,
      serial: entity.serial,
      delivery: entity.delivery ?? {},
      error:
        status === TransactionStatus.FAILED
          ? { code: entity.errorCode ?? 'FAILED', message: entity.errorMessage }
          : null,
      createdAt: entity.createdAt,
      completedAt:
        status === TransactionStatus.COMPLETED ||
        status === TransactionStatus.FAILED
          ? entity.completedAt
          : null,
    });
  }
}

export class AdminOrderResponse {
  @ApiProperty() id: string;
  @ApiProperty() transCode: string;
  @ApiProperty() merchantId: string;
  @ApiProperty() requestId: string;
  @ApiProperty() status: string;
  @ApiProperty() action: string;
  @ApiProperty() supplierCode: string;
  @ApiProperty() packageCode: string;
  @ApiPropertyOptional({ nullable: true }) supplierTransId: string | null;
  @ApiProperty() configVersion: number;
  @ApiPropertyOptional({ nullable: true }) phone: string | null;
  @ApiPropertyOptional({ nullable: true }) serial: string | null;
  @ApiProperty() submitCount: number;
  @ApiProperty() checkCount: number;
  @ApiProperty() resubmitRequested: boolean;
  @ApiPropertyOptional({ nullable: true }) nextCheckAt: Date | null;
  @ApiProperty({ type: Object }) delivery: OrderDelivery;
  @ApiPropertyOptional({ nullable: true }) errorCode: string | null;
  @ApiPropertyOptional({ nullable: true }) errorMessage: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional({ nullable: true }) completedAt: Date | null;

  static fromEntity(entity: TransactionEntity): AdminOrderResponse {
    return Object.assign(new AdminOrderResponse(), {
      id: entity.id,
      transCode: entity.transCode,
      merchantId: entity.merchantId,
      requestId: entity.partnerTransId,
      status: entity.status,
      action: entity.action,
      supplierCode: entity.supplierCode,
      packageCode: entity.packageCode,
      supplierTransId: entity.supplierTransId,
      configVersion: entity.configVersion,
      phone: entity.phone,
      serial: entity.serial,
      submitCount: entity.submitCount,
      checkCount: entity.checkCount,
      resubmitRequested: entity.resubmitRequested,
      nextCheckAt: entity.nextCheckAt,
      delivery: entity.delivery ?? {},
      errorCode: entity.errorCode,
      errorMessage: entity.errorMessage,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      completedAt: entity.completedAt,
    });
  }
}

export class TransactionEventResponse {
  @ApiProperty() id: string;
  @ApiProperty() source: string;
  @ApiProperty() type: string;
  @ApiPropertyOptional({ nullable: true }) outcome: string | null;
  @ApiPropertyOptional({ nullable: true }) fromStatus: string | null;
  @ApiPropertyOptional({ nullable: true }) toStatus: string | null;
  @ApiPropertyOptional({ nullable: true }) configVersion: number | null;
  @ApiPropertyOptional({ nullable: true }) httpStatus: number | null;
  @ApiPropertyOptional({ nullable: true }) durationMs: number | null;
  @ApiPropertyOptional({ nullable: true }) message: string | null;
  @ApiPropertyOptional() request: unknown;
  @ApiPropertyOptional() response: unknown;
  @ApiProperty() createdAt: Date;

  static fromEntity(entity: TransactionEventEntity): TransactionEventResponse {
    return Object.assign(new TransactionEventResponse(), {
      id: entity.id,
      source: entity.source,
      type: entity.type,
      outcome: entity.outcome,
      fromStatus: entity.fromStatus,
      toStatus: entity.toStatus,
      configVersion: entity.configVersion,
      httpStatus: entity.httpStatus,
      durationMs: entity.durationMs,
      message: entity.message,
      request: entity.request,
      response: entity.response,
      createdAt: entity.createdAt,
    });
  }
}
