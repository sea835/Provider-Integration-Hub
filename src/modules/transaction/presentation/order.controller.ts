import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { MerchantAuth } from '@modules/merchant/presentation/decorators/merchant-auth.decorator';
import { CurrentMerchant } from '@modules/merchant/presentation/decorators/current-merchant.decorator';
import type { AuthenticatedMerchant } from '@modules/merchant/domain/merchant.entity';
import { OrderService } from '@modules/transaction/application/order.service';
import { OrderQueryService } from '@modules/transaction/application/order-query.service';
import {
  CreateOrderRequest,
  FindOrderQuery,
} from '@modules/transaction/presentation/dto/order.request';
import { OrderResponse } from '@modules/transaction/presentation/dto/order.response';

@MerchantAuth()
@ApiTags('store')
@Controller('v1/orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderQuery: OrderQueryService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'G2: Tạo đơn (202 đơn mới, 200 gửi lại cùng requestId)',
  })
  async create(
    @CurrentMerchant() merchant: AuthenticatedMerchant,
    @Body() dto: CreateOrderRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderResponse> {
    const { created, order } = await this.orderService.accept(merchant, dto);
    res.status(created ? HttpStatus.ACCEPTED : HttpStatus.OK);
    return OrderResponse.fromEntity(order);
  }

  @Get()
  @ApiOperation({ summary: 'G8: Tra cứu đơn theo requestId' })
  async findByRequestId(
    @CurrentMerchant() merchant: AuthenticatedMerchant,
    @Query() query: FindOrderQuery,
  ): Promise<OrderResponse> {
    return OrderResponse.fromEntity(
      await this.orderQuery.getByRequestId(merchant.id, query.requestId),
    );
  }

  @Get(':transCode')
  @ApiOperation({ summary: 'G8: Tra cứu đơn theo transCode' })
  async get(
    @CurrentMerchant() merchant: AuthenticatedMerchant,
    @Param('transCode') transCode: string,
  ): Promise<OrderResponse> {
    return OrderResponse.fromEntity(
      await this.orderQuery.getForMerchant(merchant.id, transCode),
    );
  }
}
