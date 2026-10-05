import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '@common/base/pagination.dto';
import { CheckPolicies } from '@modules/authorization/presentation/decorators/check-policies.decorator';
import { Action } from '@modules/authorization/domain/action.enum';
import { CurrentUser } from '@modules/authentication/presentation/decorators/current-user.decorator';
import { MerchantEntity } from '@modules/merchant/domain/merchant.entity';
import { MerchantService } from '@modules/merchant/application/merchant.service';
import {
  CreateMerchantRequest,
  UpdateMerchantRequest,
} from '@modules/merchant/presentation/dto/merchant.request';
import {
  MerchantCallbackSecretResponse,
  MerchantResponse,
  MerchantWithKeyResponse,
} from '@modules/merchant/presentation/dto/merchant.response';

@CheckPolicies((ability) => ability.can(Action.Manage, MerchantEntity))
@ApiTags('admin-merchants')
@ApiBearerAuth()
@Controller('admin/merchants')
export class AdminMerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách merchant' })
  async list(@Query() query: PaginationQueryDto) {
    const result = await this.merchantService.list(query);
    return {
      data: result.data.map((m) => MerchantResponse.fromEntity(m)),
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết merchant' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<MerchantResponse> {
    return MerchantResponse.fromEntity(await this.merchantService.get(id));
  }

  @Post()
  @ApiOperation({ summary: 'Tạo merchant (trả API key một lần)' })
  async create(
    @Body() dto: CreateMerchantRequest,
    @CurrentUser('sub') actorId: string,
  ): Promise<MerchantWithKeyResponse> {
    const { merchant, apiKey } = await this.merchantService.create(
      dto,
      actorId,
    );
    return MerchantWithKeyResponse.withKey(merchant, apiKey);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật merchant' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMerchantRequest,
    @CurrentUser('sub') actorId: string,
  ): Promise<MerchantResponse> {
    return MerchantResponse.fromEntity(
      await this.merchantService.update(id, dto, actorId),
    );
  }

  @Post(':id/rotate-key')
  @ApiOperation({ summary: 'Cấp API key mới (key cũ hết hiệu lực ngay)' })
  async rotateKey(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<MerchantWithKeyResponse> {
    const { merchant, apiKey } = await this.merchantService.rotateKey(
      id,
      actorId,
    );
    return MerchantWithKeyResponse.withKey(merchant, apiKey);
  }

  @Post(':id/callback-secret')
  @ApiOperation({
    summary:
      'Tạo khoá ký callback mới (trả một lần, khoá cũ hết hiệu lực ngay)',
  })
  async rotateCallbackSecret(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<MerchantCallbackSecretResponse> {
    const { merchant, secret } =
      await this.merchantService.rotateCallbackSecret(id, actorId);
    return MerchantCallbackSecretResponse.withSecret(merchant, secret);
  }
}
