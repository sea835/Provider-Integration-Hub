import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@common/base/pagination.dto';
import { Action } from '@modules/authorization/domain/action.enum';
import { CheckPolicies } from '@modules/authorization/presentation/decorators/check-policies.decorator';
import { BalanceCheckService } from '@modules/provider/application/balance-check.service';
import { ProviderService } from '@modules/provider/application/provider.service';
import { BALANCE_CHECK_SUBJECT } from '@modules/provider/domain/provider-status';
import {
  BalanceCheckQuery,
  BalanceCheckResponse,
  BalanceSeriesQuery,
  BalanceSeriesResponse,
} from '@modules/provider/presentation/dto/balance-check.dto';

@CheckPolicies((ability) => ability.can(Action.Read, BALANCE_CHECK_SUBJECT))
@ApiTags('balance-checks')
@ApiBearerAuth()
@Controller('admin/balance-checks')
export class BalanceCheckController {
  constructor(
    private readonly checks: BalanceCheckService,
    private readonly providers: ProviderService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lịch sử kiểm tra số dư, lọc theo đối tác, kết quả, thời gian',
  })
  async history(
    @Query() query: BalanceCheckQuery,
  ): Promise<PaginatedResult<BalanceCheckResponse>> {
    const { data, meta } = await this.checks.history(query);
    return {
      data: data.map((item) => BalanceCheckResponse.fromEntity(item)),
      meta,
    };
  }

  @Get('series')
  @ApiOperation({ summary: 'Số dư theo thời gian của từng đối tác (biểu đồ)' })
  async series(
    @Query() query: BalanceSeriesQuery,
  ): Promise<BalanceSeriesResponse[]> {
    const providerIds =
      query.providerIds && query.providerIds.length > 0
        ? query.providerIds
        : (await this.providers.list()).map((item) => item.id);
    const points = await this.checks.series(providerIds, query.range ?? '24h');
    return BalanceSeriesResponse.fromPoints(providerIds, points);
  }
}
