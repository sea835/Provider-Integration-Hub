import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  STORE_CALLBACK_STATUS_VALUES,
  type StoreCallbackStatusType,
} from '@modules/transaction/domain/store-callback';

export class StoreCallbackListQuery {
  @ApiPropertyOptional({ enum: STORE_CALLBACK_STATUS_VALUES })
  @IsOptional()
  @IsIn(STORE_CALLBACK_STATUS_VALUES)
  status?: StoreCallbackStatusType;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
