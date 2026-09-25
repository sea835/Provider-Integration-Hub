import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionService } from '../application/permission.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { PermissionResponseDto } from './dto/permission.response';
import { CheckPolicies } from './decorators/check-policies.decorator';
import { Action } from '../domain/action.enum';

@CheckPolicies((ability) => ability.can(Action.Manage, 'all'))
@ApiTags('authorization-permissions')
@ApiBearerAuth()
@Controller('authorization/permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo quyền hạn mới' })
  async create(
    @Body() dto: CreatePermissionDto,
  ): Promise<PermissionResponseDto> {
    const permission = await this.permissionService.createPermission(dto);
    return PermissionResponseDto.fromEntity(permission);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh mục tất cả quyền hạn' })
  async findAll(): Promise<PermissionResponseDto[]> {
    const permissions = await this.permissionService.findAllPermissions();
    return permissions.map((p) => PermissionResponseDto.fromEntity(p));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết quyền hạn theo ID' })
  async findOne(@Param('id') id: string): Promise<PermissionResponseDto> {
    const permission = await this.permissionService.findPermissionById(id);
    return PermissionResponseDto.fromEntity(permission);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa quyền hạn theo ID' })
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    const success = await this.permissionService.deletePermission(id);
    return { success };
  }
}
