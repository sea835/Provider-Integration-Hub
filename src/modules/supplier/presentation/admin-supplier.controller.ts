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
import { AdapterTypeResponse } from '@modules/supplier/presentation/dto/adapter-type.response';
import { IntegrationPreviewRequest } from '@modules/supplier/presentation/dto/integration-preview.request';
import { IntegrationPreviewService } from '@modules/provider-adapter/application/integration-preview.service';
import { IntegrationCallService } from '@modules/provider-adapter/application/integration-call.service';
import type {
  LiveCallOutput,
  SupplierOrdersOutput,
} from '@modules/provider-adapter/application/integration-call.service';
import { SupplierOrdersRequest } from '@modules/supplier/presentation/dto/supplier-orders.request';
import { IntegrationCallRequest } from '@modules/supplier/presentation/dto/integration-call.request';
import type { PreviewOutput } from '@modules/provider-adapter/application/integration-preview.service';
import type { ConnectionTestResult } from '@modules/provider-adapter/domain/provider-adapter.port';

@CheckPolicies((ability) => ability.can(Action.Manage, SupplierEntity))
@ApiTags('admin-suppliers')
@ApiBearerAuth()
@Controller('admin/suppliers')
export class AdminSupplierController {
  constructor(
    private readonly supplierService: SupplierService,
    private readonly integrationPreview: IntegrationPreviewService,
    private readonly integrationCall: IntegrationCallService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách nhà cung cấp' })
  async list(@Query() query: PaginationQueryDto) {
    const result = await this.supplierService.list(query);
    return {
      data: result.data.map((s) => SupplierResponse.fromEntity(s)),
      meta: result.meta,
    };
  }

  @Get('adapter-types')
  @ApiOperation({
    summary: 'Các loại adapter có sẵn và trường cấu hình của từng loại',
  })
  adapterTypes(): AdapterTypeResponse[] {
    return this.supplierService
      .adapterTypes()
      .map((descriptor) => AdapterTypeResponse.from(descriptor));
  }

  @Post('integration-preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Phân loại thử cho NCC Tự cấu hình: dựng request mẫu và đọc phản hồi mẫu, không gọi NCC',
  })
  previewIntegration(@Body() dto: IntegrationPreviewRequest): PreviewOutput {
    return this.integrationPreview.preview(dto);
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

  @Post(':id/integration-call')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Gọi thử thật API chỉ đọc (GET tra cứu / kiểm tra kết nối) bằng bản tích hợp đang sửa; không bao giờ gửi đơn',
  })
  async callIntegration(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IntegrationCallRequest,
  ): Promise<LiveCallOutput> {
    const { ctx, adapterType } = await this.supplierService.liveContext(id);
    return this.integrationCall.call({
      ctx,
      adapterType,
      params: dto.params,
      kind: dto.kind,
      order: dto.order,
      range: dto.range,
      secrets: dto.secrets,
    });
  }

  @Post(':id/supplier-orders')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'API 5: xem đơn phía nhà cung cấp trong một khoảng thời gian (tối đa 31 ngày), dùng cấu hình đã lưu',
  })
  async supplierOrders(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SupplierOrdersRequest,
  ): Promise<SupplierOrdersOutput> {
    const { ctx, adapterType } = await this.supplierService.liveContext(id);
    return this.integrationCall.supplierOrders(ctx, adapterType, dto);
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
