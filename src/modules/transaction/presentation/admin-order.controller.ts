import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '@modules/authorization/presentation/decorators/check-policies.decorator';
import { Action } from '@modules/authorization/domain/action.enum';
import { CurrentUser } from '@modules/authentication/presentation/decorators/current-user.decorator';
import { TransactionEntity } from '@modules/transaction/domain/transaction.entity';
import { TransactionStatus } from '@modules/transaction/domain/transaction-status';
import { InvalidStateTransitionError } from '@modules/transaction/domain/transaction.errors';
import { OrderQueuePort } from '@modules/transaction/domain/order-queue.port';
import { OrderQueryService } from '@modules/transaction/application/order-query.service';
import { OrderStateService } from '@modules/transaction/application/order-state.service';
import { OrderReconcileService } from '@modules/transaction/application/order-reconcile.service';
import type { OrderLookupOutput } from '@modules/transaction/application/order-reconcile.service';
import {
  AdminOrderQuery,
  RecheckOrderRequest,
  ResolveOrderRequest,
} from '@modules/transaction/presentation/dto/order.request';
import {
  AdminOrderResponse,
  TransactionEventResponse,
} from '@modules/transaction/presentation/dto/order.response';

@CheckPolicies((ability) => ability.can(Action.Manage, TransactionEntity))
@ApiTags('admin-orders')
@ApiBearerAuth()
@Controller('admin/orders')
export class AdminOrderController {
  constructor(
    private readonly orderQuery: OrderQueryService,
    private readonly orderState: OrderStateService,
    private readonly queue: OrderQueuePort,
    private readonly reconcile: OrderReconcileService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách đơn (lọc theo trạng thái, NCC, merchant)',
  })
  async list(@Query() query: AdminOrderQuery) {
    const result = await this.orderQuery.listForAdmin({
      status: query.status,
      supplierCode: query.supplierCode,
      merchantId: query.merchantId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
    return {
      data: result.data.map((o) => AdminOrderResponse.fromEntity(o)),
      meta: result.meta,
    };
  }

  @Get(':transCode')
  @ApiOperation({ summary: 'Chi tiết đơn (đầy đủ thông tin nội bộ)' })
  async get(
    @Param('transCode') transCode: string,
  ): Promise<AdminOrderResponse> {
    return AdminOrderResponse.fromEntity(
      await this.orderQuery.getByTransCode(transCode),
    );
  }

  @Get(':transCode/events')
  @ApiOperation({ summary: 'Lịch sử sự kiện của đơn' })
  async events(
    @Param('transCode') transCode: string,
  ): Promise<TransactionEventResponse[]> {
    const events = await this.orderQuery.listEvents(transCode);
    return events.map((e) => TransactionEventResponse.fromEntity(e));
  }

  @Post(':transCode/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vận hành chốt kết quả đơn chưa ở trạng thái cuối' })
  async resolve(
    @Param('transCode') transCode: string,
    @Body() dto: ResolveOrderRequest,
    @CurrentUser('sub') actorId: string,
  ): Promise<AdminOrderResponse> {
    return AdminOrderResponse.fromEntity(
      await this.orderState.resolve(
        transCode,
        dto.outcome,
        dto.reason,
        actorId,
        {
          errorCode: dto.errorCode,
          supplierTransId: dto.supplierTransId,
          delivery: dto.delivery,
        },
      ),
    );
  }

  @Post(':transCode/lookup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Đối soát: hỏi NCC ngay xem đơn đang thế nào. Không đổi trạng thái đơn; vận hành tự chốt sau',
  })
  lookup(@Param('transCode') transCode: string): Promise<OrderLookupOutput> {
    return this.reconcile.lookup(transCode);
  }

  @Post(':transCode/recheck')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Cho đơn MANUAL_REVIEW tra cứu lại tự động: về PROCESSING, tra cứu ngay rồi poll theo lịch, thời gian chờ tính lại từ đầu. Không gửi lại đơn',
  })
  async recheck(
    @Param('transCode') transCode: string,
    @Body() dto: RecheckOrderRequest,
    @CurrentUser('sub') actorId: string,
  ): Promise<AdminOrderResponse> {
    const order = await this.orderState.reopenForCheck(
      transCode,
      dto.reason?.trim() || 'Vận hành cho tra cứu lại',
      actorId,
    );
    await this.queue.enqueueCheck(
      order.supplierCode,
      order.transCode,
      order.checkCount + 1,
      0,
    );
    return AdminOrderResponse.fromEntity(order);
  }

  @Post(':transCode/check')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Tra cứu lại NCC ngay (đơn đang PROCESSING)' })
  async checkNow(
    @Param('transCode') transCode: string,
  ): Promise<{ queued: boolean }> {
    const order = await this.orderQuery.getByTransCode(transCode);
    if (order.status !== TransactionStatus.PROCESSING) {
      throw new InvalidStateTransitionError(
        `Chỉ tra cứu lại được đơn PROCESSING, đơn đang ${order.status}`,
      );
    }
    await this.queue.enqueueCheck(
      order.supplierCode,
      order.transCode,
      order.checkCount + 1,
      0,
    );
    return { queued: true };
  }
}
