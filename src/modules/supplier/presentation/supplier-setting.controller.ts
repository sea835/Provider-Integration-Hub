import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupplierSettingService } from '../application/supplier-setting.service';
import { CreateSupplierSettingDto } from './dto/create-supplier-setting.dto';
import { UpdateSupplierSettingDto } from './dto/update-supplier-setting.dto';
import { PaginationQueryDto } from '@common/base/base.repository';

@ApiTags('Supplier Settings')
@ApiBearerAuth()
@Controller('supplier-settings')
export class SupplierSettingController {
  constructor(
    private readonly supplierSettingService: SupplierSettingService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo cấu hình nhà cung cấp mới' })
  async create(@Body() dto: CreateSupplierSettingDto) {
    return this.supplierSettingService.createSetting(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách cấu hình nhà cung cấp' })
  async findAll(@Query() query: PaginationQueryDto) {
    return this.supplierSettingService.findPaginated(query);
  }

  @Get('by-supplier/:supplierId')
  @ApiOperation({ summary: 'Lấy cấu hình theo supplierId' })
  async findBySupplierId(@Param('supplierId') supplierId: string) {
    return this.supplierSettingService.getBySupplierId(supplierId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết cấu hình theo ID' })
  async findOne(@Param('id') id: string) {
    return this.supplierSettingService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật cấu hình nhà cung cấp' })
  async update(@Param('id') id: string, @Body() dto: UpdateSupplierSettingDto) {
    return this.supplierSettingService.updateSetting(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xoá cấu hình nhà cung cấp' })
  async delete(@Param('id') id: string) {
    return { success: await this.supplierSettingService.remove(id) };
  }
}
