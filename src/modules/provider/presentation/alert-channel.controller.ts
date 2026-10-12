import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@modules/authentication/presentation/decorators/current-user.decorator';
import { Action } from '@modules/authorization/domain/action.enum';
import { CheckPolicies } from '@modules/authorization/presentation/decorators/check-policies.decorator';
import { AlertChannelService } from '@modules/provider/application/alert-channel.service';
import { ALERT_CHANNEL_SUBJECT } from '@modules/provider/domain/alert-channel.entity';
import {
  DeliveryResponse,
  TelegramSettingsResponse,
  TestTelegramRequest,
  UpdateTelegramRequest,
} from '@modules/provider/presentation/dto/alert-channel.dto';

@ApiTags('alert-channels')
@ApiBearerAuth()
@Controller('admin/alert-channels')
export class AlertChannelController {
  constructor(private readonly channels: AlertChannelService) {}

  @Get('telegram')
  @CheckPolicies((ability) => ability.can(Action.Read, ALERT_CHANNEL_SUBJECT))
  @ApiOperation({ summary: 'Cấu hình kênh Telegram (không trả bot token)' })
  async getTelegram(): Promise<TelegramSettingsResponse> {
    return TelegramSettingsResponse.from(await this.channels.getTelegram());
  }

  @Put('telegram')
  @CheckPolicies((ability) => ability.can(Action.Update, ALERT_CHANNEL_SUBJECT))
  @ApiOperation({ summary: 'Lưu bot token, Chat ID và bật / tắt kênh' })
  async updateTelegram(
    @Body() body: UpdateTelegramRequest,
    @CurrentUser('sub') userId: string,
  ): Promise<TelegramSettingsResponse> {
    return TelegramSettingsResponse.from(
      await this.channels.updateTelegram(body, userId),
    );
  }

  @Post('telegram/test')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => ability.can(Action.Update, ALERT_CHANNEL_SUBJECT))
  @ApiOperation({
    summary: 'Gửi tin thử bằng giá trị đang soạn hoặc giá trị đã lưu',
  })
  async testTelegram(
    @Body() body: TestTelegramRequest,
    @CurrentUser('email') email: string,
  ): Promise<DeliveryResponse> {
    return DeliveryResponse.from(
      await this.channels.testTelegram(body, email ?? 'quản trị viên'),
    );
  }
}
