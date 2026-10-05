import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '@modules/authorization/presentation/decorators/check-policies.decorator';
import { Action } from '@modules/authorization/domain/action.enum';
import { MerchantEntity } from '@modules/merchant/domain/merchant.entity';
import { TransactionEntity } from '@modules/transaction/domain/transaction.entity';
import {
  CallbackTestResult,
  StoreCallbackService,
} from '@modules/store-callback/application/store-callback.service';
import { StoreCallbackResponse } from '@modules/store-callback/presentation/dto/store-callback.response';
import { StoreCallbackListQuery } from '@modules/store-callback/presentation/dto/store-callback.request';

@ApiTags('admin-store-callbacks')
@ApiBearerAuth()
@Controller('admin')
export class AdminStoreCallbackController {
  constructor(private readonly callbacks: StoreCallbackService) {}

  @Post('merchants/:id/callback-test')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => ability.can(Action.Manage, MerchantEntity))
  @ApiOperation({
    summary:
      'Gửi thử sự kiện ping về địa chỉ callback của Store (có ký), trả nguyên kết quả',
  })
  test(@Param('id', ParseUUIDPipe) id: string): Promise<CallbackTestResult> {
    return this.callbacks.test(id);
  }

  @Get('merchants/:id/callbacks')
  @CheckPolicies((ability) => ability.can(Action.Manage, MerchantEntity))
  @ApiOperation({ summary: 'Callback gần đây của Store' })
  async listByMerchant(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: StoreCallbackListQuery,
  ): Promise<StoreCallbackResponse[]> {
    const rows = await this.callbacks.list({
      merchantId: id,
      status: query.status,
      limit: query.limit ?? 50,
    });
    return rows.map((row) => StoreCallbackResponse.fromEntity(row));
  }

  @Get('orders/:transCode/callbacks')
  @CheckPolicies((ability) => ability.can(Action.Manage, TransactionEntity))
  @ApiOperation({ summary: 'Các lần báo kết quả đơn về Store' })
  async listByOrder(
    @Param('transCode') transCode: string,
  ): Promise<StoreCallbackResponse[]> {
    const rows = await this.callbacks.listByOrder(transCode);
    return rows.map((row) => StoreCallbackResponse.fromEntity(row));
  }

  @Post('store-callbacks/:id/retry')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => ability.can(Action.Manage, TransactionEntity))
  @ApiOperation({ summary: 'Gửi lại callback ngay (kể cả đã gửi thành công)' })
  async retry(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StoreCallbackResponse> {
    return StoreCallbackResponse.fromEntity(await this.callbacks.retry(id));
  }
}
