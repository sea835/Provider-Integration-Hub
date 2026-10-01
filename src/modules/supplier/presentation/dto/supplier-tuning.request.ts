import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsIP,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class SupplierTuningRequest {
  @ApiPropertyOptional({ example: 30000, description: 'Timeout gửi đơn (ms)' })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(120000)
  submitTimeoutMs?: number;

  @ApiPropertyOptional({
    example: 10000,
    description: 'Timeout tra cứu đơn (ms)',
  })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(120000)
  queryTimeoutMs?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Số job chạy song song mỗi process worker',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  concurrency?: number;

  @ApiPropertyOptional({
    example: 60,
    description: 'Giới hạn số lời gọi NCC mỗi phút (toàn queue)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimitPerMin?: number;

  @ApiPropertyOptional({
    example: [5, 10, 20, 40, 60, 120, 300, 900, 1800, 3600],
    description: 'Lịch poll (giây), hết mảng thì lặp phần tử cuối',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  pollScheduleSec?: number[];

  @ApiPropertyOptional({
    example: 86400,
    description: 'Thời gian chờ tối đa trước khi chuyển MANUAL_REVIEW (giây)',
  })
  @IsOptional()
  @IsInt()
  @Min(60)
  maxWaitSec?: number;

  @ApiPropertyOptional({
    example: 2,
    description: 'Số lần gửi lại tối đa khi NCC không tìm thấy đơn',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  maxResubmit?: number;

  @ApiPropertyOptional({
    example: ['203.0.113.10'],
    description: 'IP được phép gọi callback',
  })
  @IsOptional()
  @IsArray()
  @IsIP(undefined, { each: true })
  callbackIpWhitelist?: string[];
}
