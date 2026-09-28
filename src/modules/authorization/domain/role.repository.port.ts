import { BaseRepositoryPort } from '@common/base/base.repository.port';
import { RoleEntity } from './role.entity';
import { PermissionEntity } from './permission.entity';

export abstract class RoleRepositoryPort extends BaseRepositoryPort<RoleEntity> {
  abstract findByCode(code: string): Promise<RoleEntity | null>;
  abstract getPermissionsByRoleCode(
    roleCode: string,
  ): Promise<PermissionEntity[]>;
  abstract getPermissionsByRoleId(roleId: string): Promise<PermissionEntity[]>;
  abstract assignPermissionsToRole(
    roleId: string,
    permissionIds: string[],
  ): Promise<void>;
}
