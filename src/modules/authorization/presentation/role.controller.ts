import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoleService } from '../application/role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { RoleResponseDto } from './dto/role.response';
import { PermissionResponseDto } from './dto/permission.response';
import { CheckPolicies } from './decorators/check-policies.decorator';
import { Action } from '../domain/action.enum';

@CheckPolicies((ability) => ability.can(Action.Manage, 'all'))
@ApiTags('authorization-roles')
@ApiBearerAuth()
@Controller('authorization/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo vai trò mới' })
  async create(@Body() dto: CreateRoleDto): Promise<RoleResponseDto> {
    const role = await this.roleService.createRole(dto);
    return RoleResponseDto.fromEntity(role);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả vai trò' })
  async findAll(): Promise<RoleResponseDto[]> {
    const roles = await this.roleService.findAllRoles();
    return roles.map((r) => RoleResponseDto.fromEntity(r));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết vai trò theo ID' })
  async findOne(@Param('id') id: string): Promise<RoleResponseDto> {
    const role = await this.roleService.findRoleById(id);
    return RoleResponseDto.fromEntity(role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin vai trò' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleResponseDto> {
    const role = await this.roleService.updateRole(id, dto);
    return RoleResponseDto.fromEntity(role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa vai trò theo ID' })
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    const success = await this.roleService.deleteRole(id);
    return { success };
  }

  @Post(':id/permissions')
  @ApiOperation({ summary: 'Gán danh sách quyền hạn cho vai trò' })
  async assignPermissions(
    @Param('id') id: string,
    @Body() dto: AssignPermissionsDto,
  ): Promise<{ success: boolean }> {
    return this.roleService.assignPermissions(id, dto.permissionIds);
  }

  @Get(':id/permissions')
  @ApiOperation({ summary: 'Lấy danh sách quyền hạn đã gán của vai trò' })
  async getPermissions(
    @Param('id') id: string,
  ): Promise<PermissionResponseDto[]> {
    const perms = await this.roleService.getRolePermissions(id);
    return perms.map((p) => PermissionResponseDto.fromEntity(p));
  }
}
