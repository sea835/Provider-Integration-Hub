import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsIP,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { MERCHANT_STATUS_VALUES } from '@modules/merchant/domain/merchant-status';
import type { MerchantStatusType } from '@modules/merchant/domain/merchant-status';

export class CreateMerchantRequest {
  @ApiProperty({ example: 'MSTORE' })
  @Matches(/^[A-Za-z0-9_]{2,50}$/, {
    message: 'Mã merchant chỉ gồm chữ, số, gạch dưới (2-50 ký tự)',
  })
  code: string;

  @ApiProperty({ example: 'M-Store' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    example: ['203.0.113.10'],
    description: 'Rỗng = không giới hạn IP',
  })
  @IsOptional()
  @IsArray()
  @IsIP(undefined, { each: true })
  ipWhitelist?: string[];
}

export class UpdateMerchantRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ enum: MERCHANT_STATUS_VALUES })
  @IsOptional()
  @IsIn(MERCHANT_STATUS_VALUES)
  status?: MerchantStatusType;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsIP(undefined, { each: true })
  ipWhitelist?: string[];
}
