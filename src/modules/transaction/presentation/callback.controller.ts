import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '@modules/authentication/presentation/decorators/public.decorator';
import { CallbackService } from '@modules/transaction/application/callback.service';

/** G6: NCC gọi về. Xác thực bằng chữ ký (nếu adapter hỗ trợ) hoặc IP whitelist. */
@Public()
@SkipThrottle()
@ApiTags('callbacks')
@Controller('v1/callbacks')
export class CallbackController {
  constructor(private readonly callbacks: CallbackService) {}

  @Post(':supplierCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'G6: Nhận callback kết quả đơn từ NCC' })
  async receive(
    @Param('supplierCode') supplierCode: string,
    @Body() body: unknown,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ code: number; message: string }> {
    await this.callbacks.handle(supplierCode.toUpperCase(), {
      body,
      rawBody: req.rawBody?.toString('utf8'),
      headers: req.headers,
      ip: req.ip ?? '',
    });
    return { code: 0, message: 'Received' };
  }
}
