import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import { SupplierTuningRequest } from '@modules/supplier/presentation/dto/supplier-tuning.request';

export class CreateSupplierRequest extends SupplierTuningRequest {
  @ApiProperty({
    example: 'ANISIM',
    description: 'Mã NCC, không đổi được sau khi tạo',
  })
  @Matches(/^[A-Za-z0-9_]{2,50}$/, {
    message: 'Mã NCC chỉ gồm chữ, số, gạch dưới (2-50 ký tự)',
  })
  code: string;

  @ApiProperty({ example: 'ANI SIM Agency' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    example: 'HTTP_CONFIG',
    description: 'Loại kết nối: HUB_STANDARD hoặc HTTP_CONFIG (tự cấu hình)',
  })
  @IsString()
  @IsNotEmpty()
  adapterType: string;

  @ApiProperty({ example: 'https://ap1.anipay.vn' })
  @IsUrl({ require_protocol: true, require_tld: false })
  baseUrl: string;

  @ApiPropertyOptional({
    type: Object,
    example: {},
    description: 'Tham số riêng của adapter',
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    example: { apiKey: 'ANI SIM_xxx' },
    description: 'Chỉ ghi, được mã hoá và không bao giờ trả lại',
  })
  @IsOptional()
  @IsObject()
  secrets?: Record<string, unknown>;
}
