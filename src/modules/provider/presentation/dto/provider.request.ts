import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  CHECK_INTERVALS,
  PROVIDER_STATUS_VALUES,
} from '@modules/provider/domain/provider-status';

const MAX_AMOUNT = 1e15;
const INTERVAL_MESSAGE = `Chu kỳ quét chỉ nhận ${CHECK_INTERVALS.join(', ')} phút`;

class ProviderSettingsFields {
  @ApiPropertyOptional({ enum: CHECK_INTERVALS, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsIn(CHECK_INTERVALS, { message: INTERVAL_MESSAGE })
  intervalMinutes?: number;

  @ApiPropertyOptional({
    example: 50000000,
    nullable: true,
    description: 'Ngưỡng cảnh báo sớm (VNĐ); null = không dùng',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({}, { message: 'Ngưỡng cảnh báo sớm phải là số' })
  @Min(0, { message: 'Ngưỡng cảnh báo sớm không được âm' })
  @Max(MAX_AMOUNT)
  warningThreshold?: number | null;

  @ApiPropertyOptional({
    example: 10000000,
    nullable: true,
    description: 'Ngưỡng khẩn cấp (VNĐ); null = không dùng',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({}, { message: 'Ngưỡng khẩn cấp phải là số' })
  @Min(0, { message: 'Ngưỡng khẩn cấp không được âm' })
  @Max(MAX_AMOUNT)
  criticalThreshold?: number | null;

  @ApiPropertyOptional({
    example: 60,
    description: 'Số phút giữa hai lần nhắc lại cùng một mức cảnh báo',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Thời gian nhắc lại phải là số nguyên (phút)' })
  @Min(5, { message: 'Thời gian nhắc lại tối thiểu 5 phút' })
  @Max(1440, { message: 'Thời gian nhắc lại tối đa 1440 phút' })
  cooldownMinutes?: number;
}

export class CreateProviderRequest extends ProviderSettingsFields {
  @ApiProperty({
    example: 'VIETTEL_DATA',
    description: 'Mã đối tác: viết hoa, không dấu, duy nhất',
  })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,49}$/, {
    message:
      'Mã đối tác gồm 2-50 ký tự A-Z, 0-9, gạch dưới và bắt đầu bằng chữ cái',
  })
  code: string;

  @ApiProperty({ example: 'Viettel Telecom - Data 4G' })
  @IsString()
  @IsNotEmpty({ message: 'Tên đối tác không được để trống' })
  @MaxLength(255)
  name: string;
}

export class UpdateProviderRequest extends ProviderSettingsFields {
  @ApiPropertyOptional({ example: 'Viettel Telecom - Data 4G' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tên đối tác không được để trống' })
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ enum: PROVIDER_STATUS_VALUES })
  @IsOptional()
  @IsIn(PROVIDER_STATUS_VALUES, {
    message: 'Trạng thái chỉ nhận ACTIVE hoặc PAUSED',
  })
  status?: string;
}

class ConfigFields {
  @ApiProperty({
    description:
      'Cấu hình gọi API: { baseUrl, vars, spec: { auth, token, signature, headers, balance } }',
    type: Object,
  })
  @IsObject({ message: 'config phải là đối tượng' })
  config: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Bí mật theo tên: chuỗi = đặt mới, null = xoá, bỏ qua hoặc rỗng = giữ nguyên',
    type: Object,
    example: { password: 'S3cret!', oldKey: null },
  })
  @IsOptional()
  @IsObject({ message: 'secrets phải là đối tượng' })
  secrets?: Record<string, string | null>;

  @ApiPropertyOptional({
    example: 1,
    description: 'Hệ số nhân để quy số dư về VNĐ (API trả nghìn đồng thì 1000)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'Hệ số đơn vị phải là số' })
  @Min(0.000001, { message: 'Hệ số đơn vị phải lớn hơn 0' })
  @Max(1e9)
  unitMultiplier?: number;
}

export class UpdateProviderConfigRequest extends ConfigFields {}

export class UpdateProviderSamplesRequest {
  @ApiPropertyOptional({
    description:
      'Phản hồi mẫu của API đăng nhập: { httpStatus, body, capturedAt }; null = xoá',
    type: Object,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject({ message: 'login phải là đối tượng hoặc null' })
  login?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description:
      'Phản hồi mẫu của API số dư: { httpStatus, body, capturedAt }; null = xoá',
    type: Object,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject({ message: 'balance phải là đối tượng hoặc null' })
  balance?: Record<string, unknown> | null;
}

export class TestConnectionRequest extends ConfigFields {
  @ApiPropertyOptional({
    description:
      'Id đối tác đang sửa: dùng bí mật đã lưu cho những khoá không nhập lại',
  })
  @IsOptional()
  @IsUUID(undefined, { message: 'providerId không hợp lệ' })
  providerId?: string;

  @ApiPropertyOptional({
    enum: ['balance', 'login'],
    default: 'balance',
    description:
      'balance: đăng nhập (nếu bật) rồi gọi API số dư. login: chỉ gọi API đăng nhập',
  })
  @IsOptional()
  @IsIn(['balance', 'login'], { message: 'scope chỉ nhận balance hoặc login' })
  scope?: 'balance' | 'login';
}
