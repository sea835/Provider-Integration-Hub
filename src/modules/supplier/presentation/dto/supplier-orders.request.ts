import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class SupplierOrdersRequest {
  @ApiPropertyOptional({ example: '2026-10-01T00:00:00+07:00' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-02T00:00:00+07:00' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
