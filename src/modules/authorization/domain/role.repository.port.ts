import { RoleEntity } from './role.entity';
import { PermissionEntity } from './permission.entity';

export abstract class RoleRepositoryPort {
  abstract create(data: Partial<RoleEntity>): Promise<RoleEntity>;
  abstract findById(id: string): Promise<RoleEntity | null>;
  abstract findByCode(code: string): Promise<RoleEntity | null>;
  abstract findAll(): Promise<RoleEntity[]>;
  abstract update(
    id: string,
    data: Partial<RoleEntity>,
  ): Promise<RoleEntity | null>;
  abstract delete(id: string): Promise<boolean>;
  abstract getPermissionsByRoleCode(roleCode: string): Promise<PermissionEntity[]>;
  abstract getPermissionsByRoleId(roleId: string): Promise<PermissionEntity[]>;
  abstract assignPermissionsToRole(
    roleId: string,
    permissionIds: string[],
  ): Promise<void>;
}
