import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ORDER_ACTION_VALUES } from '@modules/provider-adapter/domain/order-action';
import type { OrderActionType } from '@modules/provider-adapter/domain/order-action';

export class ListPackagesQuery {
  @ApiPropertyOptional({ enum: ORDER_ACTION_VALUES })
  @IsOptional()
  @IsIn(ORDER_ACTION_VALUES)
  action?: OrderActionType;

  @ApiPropertyOptional({
    example: '0912345678',
    description: 'Một số NCC chỉ trả gói phù hợp với thuê bao',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: '8984012601500769003' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  serial?: string;
}

export class CheckPackageRequest {
  @ApiProperty({ example: 'ANISIM' })
  @Matches(/^[A-Za-z0-9_]{2,50}$/, {
    message: 'supplierCode chỉ gồm chữ, số, gạch dưới (2-50 ký tự)',
  })
  supplierCode: string;

  @ApiProperty({ enum: ORDER_ACTION_VALUES })
  @IsIn(ORDER_ACTION_VALUES)
  action: OrderActionType;

  @ApiProperty({ example: 'plan-esim-5gb' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  packageCode: string;

  @ApiPropertyOptional({ example: '0912345678' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: '8984012601500769003' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  serial?: string;
}
