import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional } from 'class-validator';
import { LIVE_CALL_KINDS } from '@modules/provider-adapter/application/integration-call.service';
import type { LiveCallKind } from '@modules/provider-adapter/application/integration-call.service';

export class IntegrationCallRequest {
  @ApiProperty({
    type: Object,
    description:
      'Bản tích hợp đang sửa (chưa cần lưu): { vars, secretKeys, spec }',
  })
  @IsObject()
  params: Record<string, unknown>;

  @ApiProperty({ enum: LIVE_CALL_KINDS })
  @IsIn(LIVE_CALL_KINDS)
  kind: LiveCallKind;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Thông tin đơn mẫu: { transCode, supplierTransId, action, packageCode, phone, serial }',
  })
  @IsOptional()
  @IsObject()
  order?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    description: 'Khoảng thời gian cho API danh sách đơn: { from, to } (ISO)',
  })
  @IsOptional()
  @IsObject()
  range?: { from?: string; to?: string };

  @ApiPropertyOptional({
    type: Object,
    description:
      'Bí mật đang nhập dở trên giao diện; bỏ trống thì dùng bí mật đã lưu',
  })
  @IsOptional()
  @IsObject()
  secrets?: Record<string, unknown>;
}
