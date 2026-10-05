import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { PREVIEW_KINDS } from '@modules/provider-adapter/application/integration-preview.service';
import type { PreviewKind } from '@modules/provider-adapter/application/integration-preview.service';

export class IntegrationPreviewRequest {
  @ApiProperty({ example: 'https://api.ncc.vn' })
  @IsString()
  baseUrl: string;

  @ApiProperty({
    type: Object,
    description: 'params của NCC Tự cấu hình: { vars, secretKeys, spec }',
  })
  @IsObject()
  params: Record<string, unknown>;

  @ApiProperty({ enum: PREVIEW_KINDS })
  @IsIn(PREVIEW_KINDS)
  kind: PreviewKind;

  @ApiPropertyOptional({
    type: Object,
    description: 'Đơn mẫu: transCode, action, packageCode, phone, serial',
  })
  @IsOptional()
  @IsObject()
  order?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    description: 'Phản hồi mẫu của NCC: { httpStatus, body, headers }',
  })
  @IsOptional()
  @IsObject()
  response?: {
    httpStatus?: number;
    body?: unknown;
    headers?: Record<string, string>;
  };
}
