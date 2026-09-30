import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { CatalogService } from '../application/catalog.service';
import { CheckPackageEligibilityDto } from './dto/check-package.dto';
import { Public } from '@modules/authentication/presentation/decorators/public.decorator';

@Controller('engine/v1')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  /**
   * Bước 1: Lấy danh mục sản phẩm / gói cước khả dụng
   * GET /engine/v1/packages (Sync < 5ms)
   */
  @Public()
  @Get('packages')
  getPackages() {
    const packages = this.catalogService.getPackages();
    return {
      code: 0,
      message: 'Success',
      data: packages,
    };
  }

  /**
   * Bước 2: Kiểm tra gói cước có phù hợp với thuê bao không
   * POST /engine/v1/check (Sync < 1s)
   */
  @Public()
  @Post('check')
  @HttpCode(HttpStatus.OK)
  async checkEligibility(@Body() dto: CheckPackageEligibilityDto) {
    const result = await this.catalogService.checkEligibility(
      dto.phone,
      dto.packageCode,
    );
    return {
      code: 0,
      message: 'Success',
      data: {
        eligible: result.eligible,
        reason: result.reason || null,
      },
    };
  }
}
