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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MerchantAuth } from '@modules/merchant/presentation/decorators/merchant-auth.decorator';
import {
  PackageCheckOutput,
  PackageListOutput,
  PackageService,
} from '@modules/package/application/package.service';
import {
  CheckPackageRequest,
  ListPackagesQuery,
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
  list(
    @Param('supplierCode') supplierCode: string,
    @Query() query: ListPackagesQuery,
  ): Promise<PackageListOutput> {
    return this.packages.listPackages({ supplierCode, ...query });
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
