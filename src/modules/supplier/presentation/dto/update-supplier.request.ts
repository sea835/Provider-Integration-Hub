import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { SupplierTuningRequest } from '@modules/supplier/presentation/dto/supplier-tuning.request';
import { SUPPLIER_STATUS_VALUES } from '@modules/supplier/domain/supplier-status';
import type { SupplierStatusType } from '@modules/supplier/domain/supplier-status';

export class UpdateSupplierRequest extends SupplierTuningRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  baseUrl?: string;

  @ApiPropertyOptional({ enum: SUPPLIER_STATUS_VALUES })
  @IsOptional()
  @IsIn(SUPPLIER_STATUS_VALUES)
  status?: SupplierStatusType;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    description: 'Có thì thay toàn bộ secret, không có thì giữ nguyên',
  })
  @IsOptional()
  @IsObject()
  secrets?: Record<string, unknown>;
}
