import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '@common/base/pagination.dto';
import { ORDER_ACTION_VALUES } from '@modules/provider-adapter/domain/order-action';
import type { OrderActionType } from '@modules/provider-adapter/domain/order-action';
import { TRANSACTION_STATUS_VALUES } from '@modules/transaction/domain/transaction-status';
import type { TransactionStatusType } from '@modules/transaction/domain/transaction-status';

export class CreateOrderRequest {
  @ApiProperty({
    example: 'SMM-20260930-0001',
    description: 'Mã đơn phía Store, duy nhất theo merchant',
  })
  @Matches(/^[A-Za-z0-9._:-]{1,64}$/, {
    message: 'requestId gồm chữ, số và . _ : - (1-64 ký tự)',
  })
  requestId: string;

  @ApiProperty({ example: 'ANISIM', description: 'Mã nhà cung cấp' })
  @Matches(/^[A-Za-z0-9_]{2,50}$/, {
    message: 'supplierCode chỉ gồm chữ, số, gạch dưới (2-50 ký tự)',
  })
  supplierCode: string;

  @ApiProperty({ enum: ORDER_ACTION_VALUES })
  @IsIn(ORDER_ACTION_VALUES)
  action: OrderActionType;

  @ApiProperty({
    example: '87196a70-196c-48cc-9a00-02a8667d9bba',
    description: 'Mã gói phía nhà cung cấp (ANI SIM: packagePlanId)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  packageCode: string;

  @ApiPropertyOptional({ example: '0914780285' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: '8984012601500769003' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  serial?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Tối đa 2KB, không gửi sang NCC',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class FindOrderQuery {
  @ApiProperty({ example: 'SMM-20260930-0001' })
  @IsString()
  @IsNotEmpty()
  requestId: string;
}

export class AdminOrderQuery extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TRANSACTION_STATUS_VALUES })
  @IsOptional()
  @IsIn(TRANSACTION_STATUS_VALUES)
  status?: TransactionStatusType;

  @ApiPropertyOptional({ example: 'ANISIM' })
  @IsOptional()
  @IsString()
  supplierCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  merchantId?: string;
}

export class ResolveOrderRequest {
  @ApiProperty({ enum: ['SUCCESS', 'FAILED'] })
  @IsIn(['SUCCESS', 'FAILED'])
  outcome: 'SUCCESS' | 'FAILED';

  @ApiProperty({ example: 'Đã đối soát với NCC: đơn thành công' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
