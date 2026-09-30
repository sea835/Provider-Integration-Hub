import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateSupplierSettingDto {
  @ApiProperty({ description: 'UUID định danh nhà cung cấp' })
  @IsUUID()
  @IsNotEmpty()
  supplierId: string;

  @ApiProperty({
    description: 'URL API của nhà cung cấp',
    example: 'https://esim.anisim.vn',
  })
  @IsString()
  @IsNotEmpty()
  baseUrl: string;

  @ApiPropertyOptional({
    description: 'Giới hạn số request mỗi phút (RPM)',
    default: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimitRpm?: number;

  @ApiPropertyOptional({
    description: 'Timeout khi gọi API (giây)',
    default: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  timeoutSeconds?: number;

  @ApiPropertyOptional({
    description: 'Chế độ thực thi: ASYNC_CALLBACK, POLLING, SYNC',
    default: 'ASYNC_CALLBACK',
  })
  @IsOptional()
  @IsString()
  executionMode?: string;

  @ApiPropertyOptional({
    description: 'Khoảng thời gian polling (giây)',
    default: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  pollingIntervalSec?: number;

  @ApiPropertyOptional({
    description: 'Số lần retry tối đa khi polling',
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPollingRetries?: number;

  @ApiPropertyOptional({
    description: 'Các tham số kết nối (API Key, Secret...) dạng JSON',
  })
  @IsOptional()
  connectionParams?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Danh sách IP whitelist dạng JSON Array',
  })
  @IsOptional()
  whitelistIps?: string[];

  @ApiPropertyOptional({
    description: 'Webhook callback URL của hệ thống nhận kết quả từ NCC',
  })
  @IsOptional()
  @IsString()
  callbackWebhookUrl?: string;

  @ApiPropertyOptional({ description: 'Metadata bổ sung' })
  @IsOptional()
  @IsString()
  metadata?: string;
}
