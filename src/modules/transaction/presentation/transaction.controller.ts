import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { TransactionService } from '../application/transaction.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Public } from '@modules/authentication/presentation/decorators/public.decorator';

@Controller('engine/v1/orders')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  /**
   * Bước 3: Tiếp nhận đơn hàng (Nạp tiền, Mua gói, Kích hoạt SIM)
   * POST /engine/v1/orders (Async Mode 2)
   */
  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(@Body() dto: CreateOrderDto) {
    const result = await this.transactionService.createOrder(dto);
    return {
      code: 0,
      message: 'Order accepted',
      data: result,
    };
  }

  /**
   * Bước 4: Tra cứu trạng thái đăng ký của đơn hàng
   * GET /engine/v1/orders/:transCode (Sync < 5ms)
   */
  @Public()
  @Get(':transCode')
  async getOrderStatus(@Param('transCode') transCode: string) {
    const result = await this.transactionService.getOrderByTransCode(transCode);
    return {
      code: 0,
      message: 'Success',
      data: result,
    };
  }

  /**
   * Bước 4 (Dự phòng): Kích hoạt polling thủ công kiểm tra trạng thái đơn
   * POST /engine/v1/orders/:transCode/poll
   */
  @Public()
  @Post(':transCode/poll')
  async pollOrderStatus(@Param('transCode') transCode: string) {
    const result = await this.transactionService.pollOrderStatus(transCode);
    return {
      code: 0,
      message: 'Poll completed',
      data: result,
    };
  }

  /**
   * Xem toàn bộ Step Logs audit của đơn hàng
   * GET /engine/v1/orders/:transCode/logs
   */
  @Public()
  @Get(':transCode/logs')
  async getOrderLogs(@Param('transCode') transCode: string) {
    const logs = await this.transactionService.getOrderLogs(transCode);
    return {
      code: 0,
      message: 'Success',
      data: logs,
    };
  }

  /**
   * Xem tiến trình Jobs của đơn hàng
   * GET /engine/v1/orders/:transCode/jobs
   */
  @Public()
  @Get(':transCode/jobs')
  async getOrderJobs(@Param('transCode') transCode: string) {
    const jobs = await this.transactionService.getOrderJobs(transCode);
    return {
      code: 0,
      message: 'Success',
      data: jobs,
    };
  }
}
