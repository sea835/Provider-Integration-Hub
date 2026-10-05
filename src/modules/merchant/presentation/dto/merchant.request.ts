import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsIP,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
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

  @ApiPropertyOptional({
    example: 'https://store.example.com/hub/callback',
    nullable: true,
    description: 'Hub POST kết quả cuối của đơn về đây. null = xoá',
  })
  @IsOptional()
  @IsUrl(
    {
      require_protocol: true,
      require_tld: false,
      protocols: ['http', 'https'],
    },
    { message: 'Địa chỉ callback phải là URL http hoặc https đầy đủ' },
  )
  @MaxLength(1000)
  callbackUrl?: string | null;

  @ApiPropertyOptional({ description: 'Bật gửi callback (cần URL và khoá ký)' })
  @IsOptional()
  @IsBoolean()
  callbackEnabled?: boolean;
}
