import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '@common/base/pagination.dto';
import { CheckPolicies } from '@modules/authorization/presentation/decorators/check-policies.decorator';
import { Action } from '@modules/authorization/domain/action.enum';
import { CurrentUser } from '@modules/authentication/presentation/decorators/current-user.decorator';
import { SupplierEntity } from '@modules/supplier/domain/supplier.entity';
import { SupplierService } from '@modules/supplier/application/supplier.service';
import { CreateSupplierRequest } from '@modules/supplier/presentation/dto/create-supplier.request';
import { UpdateSupplierRequest } from '@modules/supplier/presentation/dto/update-supplier.request';
import { SupplierResponse } from '@modules/supplier/presentation/dto/supplier.response';
import type { ConnectionTestResult } from '@modules/provider-adapter/domain/provider-adapter.port';

@CheckPolicies((ability) => ability.can(Action.Manage, SupplierEntity))
@ApiTags('admin-suppliers')
@ApiBearerAuth()
@Controller('admin/suppliers')
export class AdminSupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách nhà cung cấp' })
  async list(@Query() query: PaginationQueryDto) {
    const result = await this.supplierService.list(query);
    return {
      data: result.data.map((s) => SupplierResponse.fromEntity(s)),
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết nhà cung cấp' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<SupplierResponse> {
    return SupplierResponse.fromEntity(await this.supplierService.get(id));
  }

  @Post()
  @ApiOperation({ summary: 'Tạo nhà cung cấp (mặc định PAUSED)' })
  async create(
    @Body() dto: CreateSupplierRequest,
    @CurrentUser('sub') actorId: string,
  ): Promise<SupplierResponse> {
    return SupplierResponse.fromEntity(
      await this.supplierService.create(dto, actorId),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật nhà cung cấp (tăng version)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierRequest,
    @CurrentUser('sub') actorId: string,
  ): Promise<SupplierResponse> {
    return SupplierResponse.fromEntity(
      await this.supplierService.update(id, dto, actorId),
    );
  }

  @Post(':id/test-connection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Thử kết nối tới nhà cung cấp' })
  testConnection(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConnectionTestResult> {
    return this.supplierService.testConnection(id);
  }
}
