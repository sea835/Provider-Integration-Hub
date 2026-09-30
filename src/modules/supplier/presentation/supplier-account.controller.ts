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
import { SupplierAccountService } from '../application/supplier-account.service';
import { SupplierAccountEntity } from '../domain/supplier-account.entity';
import { CreateSupplierAccountDto } from './dto/create-supplier-account.dto';
import { UpdateSupplierAccountDto } from './dto/update-supplier-account.dto';
import { PaginationQueryDto } from '@common/base/base.repository';

@ApiTags('Supplier Accounts')
@ApiBearerAuth()
@Controller('supplier-accounts')
export class SupplierAccountController {
  constructor(
    private readonly supplierAccountService: SupplierAccountService,
  ) {}

  private sanitize(
    account: SupplierAccountEntity,
  ): Partial<SupplierAccountEntity> {
    const copy: Record<string, unknown> = { ...account };
    delete copy.passwordHash;
    return copy;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo tài khoản nhà cung cấp mới' })
  async create(@Body() dto: CreateSupplierAccountDto) {
    const account = await this.supplierAccountService.createAccount(dto);
    return this.sanitize(account);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tài khoản nhà cung cấp' })
  async findAll(@Query() query: PaginationQueryDto) {
    const result = await this.supplierAccountService.findPaginated(query);
    return {
      ...result,
      data: result.data.map((acc) => this.sanitize(acc)),
    };
  }

  @Get('by-supplier/:supplierId')
  @ApiOperation({ summary: 'Lấy danh sách tài khoản theo supplierId' })
  async findBySupplierId(@Param('supplierId') supplierId: string) {
    const accounts =
      await this.supplierAccountService.getBySupplierId(supplierId);
    return accounts.map((acc) => this.sanitize(acc));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin tài khoản theo ID' })
  async findOne(@Param('id') id: string) {
    const account = await this.supplierAccountService.findOne(id);
    return this.sanitize(account);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật tài khoản nhà cung cấp' })
  async update(@Param('id') id: string, @Body() dto: UpdateSupplierAccountDto) {
    const updated = await this.supplierAccountService.updateAccount(id, dto);
    return this.sanitize(updated);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xoá tài khoản nhà cung cấp' })
  async delete(@Param('id') id: string) {
    return { success: await this.supplierAccountService.remove(id) };
  }
}
