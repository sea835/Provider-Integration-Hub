import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ORDER_ACTION_VALUES } from '@modules/provider-adapter/domain/order-action';
import type { OrderActionType } from '@modules/provider-adapter/domain/order-action';
import { InvalidOrderRequestError } from '@modules/transaction/domain/transaction.errors';

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

  @ApiPropertyOptional({
    type: Object,
    example: { provider: 'viettel' },
    description: 'Trường thêm của nhà cung cấp (theo khai báo của từng NCC)',
  })
  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}

export interface ParsedPackagesQuery {
  action?: OrderActionType;
  phone?: string;
  serial?: string;
  extra: Record<string, unknown>;
}

const KNOWN_QUERY = new Set(['action', 'phone', 'serial']);

function single(raw: unknown, name: string, max: number): string | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (typeof raw !== 'string' || raw.length > max) {
    throw new InvalidOrderRequestError(
      `${name} phải là một chuỗi tối đa ${max} ký tự`,
    );
  }
  return raw;
}

/**
 * Query của API danh sách gói: action, phone, serial và các trường thêm của NCC gửi thẳng
 * làm tham số (vd ?provider=viettel). Trường thêm được kiểm tra theo khai báo của NCC ở service.
 */
export function parsePackagesQuery(
  raw: Record<string, unknown>,
): ParsedPackagesQuery {
  const action = single(raw.action, 'action', 30);
  if (action && !(ORDER_ACTION_VALUES as readonly string[]).includes(action)) {
    throw new InvalidOrderRequestError(
      `action phải là một trong: ${ORDER_ACTION_VALUES.join(', ')}`,
    );
  }
  const extra = Object.fromEntries(
    Object.entries(raw).filter(([key]) => !KNOWN_QUERY.has(key)),
  );
  return {
    action: action as OrderActionType | undefined,
    phone: single(raw.phone, 'phone', 20),
    serial: single(raw.serial, 'serial', 30),
    extra,
  };
}
