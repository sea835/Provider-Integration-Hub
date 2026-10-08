import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ORDER_ACTION_VALUES } from '@modules/provider-adapter/domain/order-action';
import { MerchantAuth } from '@modules/merchant/presentation/decorators/merchant-auth.decorator';
import {
  PackageCheckOutput,
  PackageListOutput,
  PackageService,
} from '@modules/package/application/package.service';
import {
  CheckPackageRequest,
  parsePackagesQuery,
} from '@modules/package/presentation/dto/package.request';

@MerchantAuth()
@ApiTags('store')
@Controller('v1')
export class PackageController {
  constructor(private readonly packages: PackageService) {}

  @Get('suppliers/:supplierCode/packages')
  @ApiOperation({
    summary:
      'API 1: danh sách gói của một nhà cung cấp (Hub gọi sang NCC, trả dạng chuẩn)',
  })
  @ApiQuery({ name: 'action', required: false, enum: ORDER_ACTION_VALUES })
  @ApiQuery({
    name: 'phone',
    required: false,
    example: '0912345678',
    description: 'Một số NCC chỉ trả gói phù hợp với thuê bao',
  })
  @ApiQuery({ name: 'serial', required: false })
  @ApiQuery({
    name: 'provider',
    required: false,
    example: 'viettel',
    description:
      'Ví dụ trường thêm: mỗi NCC khai báo trường thêm riêng, Store gửi thẳng làm tham số (?provider=viettel). Tham số lạ bị 400',
  })
  list(
    @Param('supplierCode') supplierCode: string,
    @Req() req: Request,
  ): Promise<PackageListOutput> {
    return this.packages.listPackages({
      supplierCode,
      ...parsePackagesQuery(req.query),
    });
  }

  @Post('packages/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'API 2: gói có đăng ký được cho thuê bao/serial này không (eligible = null là chưa rõ)',
  })
  check(@Body() dto: CheckPackageRequest): Promise<PackageCheckOutput> {
    return this.packages.checkPackage(dto);
  }
}
