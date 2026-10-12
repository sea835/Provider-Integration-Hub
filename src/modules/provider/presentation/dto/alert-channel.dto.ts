import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import type { TelegramSettings } from '@modules/provider/application/alert-channel.service';
import type { DeliveryResult } from '@modules/provider/domain/alert-notifier.port';

export class TestTelegramRequest {
  @ApiPropertyOptional({
    example: '-1001234567890',
    description: 'Id nhóm / kênh hoặc @tên_kênh; bỏ qua = dùng giá trị đã lưu',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  chatId?: string;

  @ApiPropertyOptional({
    description: 'Token của bot; bỏ qua hoặc rỗng = dùng token đã lưu',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  botToken?: string;
}

export class UpdateTelegramRequest extends TestTelegramRequest {
  @ApiPropertyOptional({ description: 'Bật / tắt gửi cảnh báo qua Telegram' })
  @IsOptional()
  @IsBoolean({ message: 'enabled phải là true hoặc false' })
  enabled?: boolean;
}

export class TelegramSettingsResponse {
  @ApiProperty({
    enum: ['DATABASE', 'ENV', 'NONE'],
    description:
      'DATABASE: đặt trên giao diện. ENV: lấy từ biến môi trường. NONE: chưa cấu hình',
  })
  source: string;
  @ApiProperty() enabled: boolean;
  @ApiProperty({ example: '-1001234567890' }) chatId: string;
  @ApiProperty({ description: 'Đã có bot token (không bao giờ trả giá trị)' })
  hasBotToken: boolean;
  @ApiProperty({ nullable: true }) updatedAt: Date | null;

  static from(settings: TelegramSettings): TelegramSettingsResponse {
    return Object.assign(new TelegramSettingsResponse(), settings);
  }
}

export class DeliveryResponse {
  @ApiProperty({ enum: ['SENT', 'FAILED', 'DISABLED'] }) status: string;
  @ApiProperty({ nullable: true, description: 'Lý do khi không gửi được' })
  detail: string | null;

  static from(result: DeliveryResult): DeliveryResponse {
    const dto = new DeliveryResponse();
    dto.status = result.status;
    dto.detail = result.detail ?? null;
    return dto;
  }
}
