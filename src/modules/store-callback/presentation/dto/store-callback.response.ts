import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoreCallbackEntity } from '@modules/transaction/domain/store-callback';

export class StoreCallbackResponse {
  @ApiProperty() id: string;
  @ApiProperty() transCode: string;
  @ApiProperty() merchantId: string;
  @ApiProperty() event: string;
  @ApiProperty({ enum: ['PENDING', 'DELIVERED', 'FAILED', 'SKIPPED'] })
  status: string;
  @ApiProperty() attempts: number;
  @ApiPropertyOptional({ nullable: true }) nextAttemptAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) lastUrl: string | null;
  @ApiPropertyOptional({ nullable: true }) lastHttpStatus: number | null;
  @ApiPropertyOptional({ nullable: true }) lastDurationMs: number | null;
  @ApiPropertyOptional({ nullable: true }) lastError: string | null;
  @ApiPropertyOptional({ nullable: true }) lastResponse: string | null;
  @ApiPropertyOptional({ nullable: true }) deliveredAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: StoreCallbackEntity): StoreCallbackResponse {
    return Object.assign(new StoreCallbackResponse(), {
      id: entity.id,
      transCode: entity.transCode,
      merchantId: entity.merchantId,
      event: entity.event,
      status: entity.status,
      attempts: entity.attempts,
      nextAttemptAt: entity.nextAttemptAt,
      lastUrl: entity.lastUrl,
      lastHttpStatus: entity.lastHttpStatus,
      lastDurationMs: entity.lastDurationMs,
      lastError: entity.lastError,
      lastResponse: entity.lastResponse,
      deliveredAt: entity.deliveredAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}
