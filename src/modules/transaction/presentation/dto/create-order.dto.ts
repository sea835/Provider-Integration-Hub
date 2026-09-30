import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
} from 'class-validator';
import type {
  UniversalAction,
  UniversalOrderDto,
} from '@modules/provider-adapter/domain/dtos/universal-order.dto';

export class CreateOrderDto implements UniversalOrderDto {
  @IsNotEmpty()
  @IsString()
  requestId: string;

  @IsNotEmpty()
  @IsEnum(['BUY_DATA', 'TOPUP', 'ACTIVATE_SIM', 'CANCEL_PACKAGE'])
  action: UniversalAction;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsNotEmpty()
  @IsString()
  packageCode: string;

  @IsOptional()
  @IsString()
  serial?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
