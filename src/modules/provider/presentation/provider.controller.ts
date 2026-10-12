import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@modules/authentication/presentation/decorators/current-user.decorator';
import { Action } from '@modules/authorization/domain/action.enum';
import { CheckPolicies } from '@modules/authorization/presentation/decorators/check-policies.decorator';
import { BalanceCheckService } from '@modules/provider/application/balance-check.service';
import { ProviderService } from '@modules/provider/application/provider.service';
import { ProviderEntity } from '@modules/provider/domain/provider.entity';
import { PROVIDER_SUBJECT } from '@modules/provider/domain/provider-status';
import { BalanceCheckResponse } from '@modules/provider/presentation/dto/balance-check.dto';
import {
  CreateProviderRequest,
  TestConnectionRequest,
  UpdateProviderConfigRequest,
  UpdateProviderRequest,
  UpdateProviderSamplesRequest,
} from '@modules/provider/presentation/dto/provider.request';
import {
  ProviderResponse,
  TestConnectionResponse,
} from '@modules/provider/presentation/dto/provider.response';

@ApiTags('providers')
@ApiBearerAuth()
@Controller('admin/providers')
export class ProviderController {
  constructor(
    private readonly providers: ProviderService,
    private readonly checks: BalanceCheckService,
  ) {}

  private view(provider: ProviderEntity): ProviderResponse {
    return ProviderResponse.fromEntity(
      provider,
      this.providers.secretKeys(provider),
      this.providers.readiness(provider),
    );
  }

  @Get()
  @CheckPolicies((ability) => ability.can(Action.Read, PROVIDER_SUBJECT))
  @ApiOperation({ summary: 'Danh sách đối tác kèm số dư và mức cảnh báo' })
  async list(): Promise<ProviderResponse[]> {
    return (await this.providers.list()).map((item) => this.view(item));
  }

  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => ability.can(Action.Manage, PROVIDER_SUBJECT))
  @ApiOperation({
    summary:
      'Gọi thử bằng cấu hình đang soạn: cả luồng số dư hoặc chỉ đăng nhập (không lưu, không cảnh báo)',
  })
  async testConnection(
    @Body() body: TestConnectionRequest,
    @CurrentUser('sub') userId: string,
  ): Promise<TestConnectionResponse> {
    return TestConnectionResponse.fromResult(
      await this.providers.testConnection(body, userId),
    );
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can(Action.Read, PROVIDER_SUBJECT))
  @ApiOperation({ summary: 'Chi tiết đối tác (không trả giá trị bí mật)' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ProviderResponse> {
    return this.view(await this.providers.get(id));
  }

  @Post()
  @CheckPolicies((ability) => ability.can(Action.Create, PROVIDER_SUBJECT))
  @ApiOperation({ summary: 'Tạo đối tác (bắt đầu ở trạng thái tạm dừng)' })
  async create(
    @Body() body: CreateProviderRequest,
    @CurrentUser('sub') userId: string,
  ): Promise<ProviderResponse> {
    return this.view(await this.providers.create(body, userId));
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can(Action.Update, PROVIDER_SUBJECT))
  @ApiOperation({
    summary: 'Sửa tên, ngưỡng, chu kỳ, thời gian nhắc lại, bật / tạm dừng',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProviderRequest,
    @CurrentUser('sub') userId: string,
  ): Promise<ProviderResponse> {
    return this.view(await this.providers.update(id, body, userId));
  }

  @Put(':id/config')
  @CheckPolicies((ability) => ability.can(Action.Manage, PROVIDER_SUBJECT))
  @ApiOperation({ summary: 'Lưu cấu hình API, bí mật và hệ số đơn vị' })
  async updateConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProviderConfigRequest,
    @CurrentUser('sub') userId: string,
  ): Promise<ProviderResponse> {
    return this.view(await this.providers.updateConfig(id, body, userId));
  }

  @Put(':id/samples')
  @CheckPolicies((ability) => ability.can(Action.Manage, PROVIDER_SUBJECT))
  @ApiOperation({
    summary: 'Lưu phản hồi mẫu (đăng nhập, số dư) để chọn trường khi cấu hình',
  })
  async updateSamples(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProviderSamplesRequest,
    @CurrentUser('sub') userId: string,
  ): Promise<ProviderResponse> {
    return this.view(await this.providers.updateSamples(id, body, userId));
  }

  @Post(':id/check')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => ability.can(Action.Update, PROVIDER_SUBJECT))
  @ApiOperation({
    summary: 'Kiểm tra số dư ngay (ghi lịch sử, áp quy tắc cảnh báo)',
  })
  async checkNow(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BalanceCheckResponse> {
    return BalanceCheckResponse.fromEntity(await this.checks.checkNow(id));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckPolicies((ability) => ability.can(Action.Delete, PROVIDER_SUBJECT))
  @ApiOperation({ summary: 'Xoá đối tác cùng lịch quét và lịch sử kiểm tra' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.providers.remove(id);
  }
}
