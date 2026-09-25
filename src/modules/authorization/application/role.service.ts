import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { RoleRepositoryPort } from '../domain/role.repository.port';
import { PermissionRepositoryPort } from '../domain/permission.repository.port';
import { RoleEntity } from '../domain/role.entity';
import { PermissionEntity } from '../domain/permission.entity';

@Injectable()
export class RoleService {
  constructor(
    private readonly roleRepository: RoleRepositoryPort,
    private readonly permissionRepository: PermissionRepositoryPort,
  ) {}

  async createRole(data: {
    code: string;
    name: string;
    description?: string;
  }): Promise<RoleEntity> {
    const existing = await this.roleRepository.findByCode(data.code);
    if (existing) {
      throw new ConflictException(`Role với mã ${data.code} đã tồn tại`);
    }

    return this.roleRepository.create({
      code: data.code.toUpperCase(),
      name: data.name,
      description: data.description,
      status: 'ACTIVE',
    });
  }

  async findAllRoles(): Promise<RoleEntity[]> {
    return this.roleRepository.findAll();
  }

  async findRoleById(id: string): Promise<RoleEntity> {
    const role = await this.roleRepository.findById(id);
    if (!role) {
      throw new NotFoundException(`Không tìm thấy Role với ID ${id}`);
    }
    return role;
  }

  async updateRole(
    id: string,
    data: { name?: string; description?: string; status?: string },
  ): Promise<RoleEntity> {
    await this.findRoleById(id);
    const updated = await this.roleRepository.update(id, data);
    if (!updated) {
      throw new NotFoundException(`Không tìm thấy Role với ID ${id}`);
    }
    return updated;
  }

  async deleteRole(id: string): Promise<boolean> {
    await this.findRoleById(id);
    return this.roleRepository.delete(id);
  }

  async assignPermissions(
    roleId: string,
    permissionIds: string[],
  ): Promise<{ success: boolean }> {
    await this.findRoleById(roleId);
    await this.roleRepository.assignPermissionsToRole(roleId, permissionIds);
    return { success: true };
  }

  async getRolePermissions(roleId: string): Promise<PermissionEntity[]> {
    await this.findRoleById(roleId);
    return this.roleRepository.getPermissionsByRoleId(roleId);
  }
}
