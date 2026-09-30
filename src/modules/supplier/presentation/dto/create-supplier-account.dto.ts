import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateSupplierAccountDto {
  @ApiProperty({ description: 'UUID định danh nhà cung cấp' })
  @IsUUID()
  @IsNotEmpty()
  supplierId: string;

  @ApiProperty({ description: 'Tên đăng nhập', example: 'anisim_admin' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ description: 'Mật khẩu', example: 'Secret123@' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    description: 'API Token / Bearer Token của NCC',
    example: 'agency_qDgbt123456...',
  })
  @IsOptional()
  @IsString()
  supplierToken?: string;

  @ApiPropertyOptional({
    description: 'Email liên hệ',
    example: 'supplier@anisim.vn',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Vai trò: SUPPLIER_ADMIN, SUPPLIER_API...',
    default: 'SUPPLIER_USER',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái tài khoản (1: Active, 0: Inactive)',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  status?: number;

  @ApiPropertyOptional({ description: 'Metadata bổ sung' })
  @IsOptional()
  @IsString()
  metadata?: string;
}
