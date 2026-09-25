import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { BaseRepository } from '@common/base/base.repository';
import { RoleEntity } from '../domain/role.entity';
import { PermissionEntity } from '../domain/permission.entity';
import { RoleRepositoryPort } from '../domain/role.repository.port';
import { roles, permissions, rolePermissions } from './authorization.schema';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';

@Injectable()
export class RoleRepository
  extends BaseRepository<RoleEntity>
  implements RoleRepositoryPort
{
  constructor(@Inject(DRIZZLE) db: NodePgDatabase) {
    super(db, roles);
  }

  async findByCode(code: string): Promise<RoleEntity | null> {
    const result = (await this.db
      .select()
      .from(roles)
      .where(eq(roles.code, code))) as RoleEntity[];
    return result[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(roles)
      .where(eq(roles.id, id))
      .returning();
    return result.length > 0;
  }

  async getPermissionsByRoleId(roleId: string): Promise<PermissionEntity[]> {
    const rows = await this.db
      .select({
        id: permissions.id,
        status: permissions.status,
        createdAt: permissions.createdAt,
        updatedAt: permissions.updatedAt,
        createdBy: permissions.createdBy,
        updatedBy: permissions.updatedBy,
        metadata: permissions.metadata,
        action: permissions.action,
        subject: permissions.subject,
        conditions: permissions.conditions,
        description: permissions.description,
      })
      .from(rolePermissions)
      .innerJoin(
        permissions,
        eq(rolePermissions.permissionId, permissions.id),
      )
      .where(eq(rolePermissions.roleId, roleId));

    return rows as PermissionEntity[];
  }

  async getPermissionsByRoleCode(roleCode: string): Promise<PermissionEntity[]> {
    const rows = await this.db
      .select({
        id: permissions.id,
        status: permissions.status,
        createdAt: permissions.createdAt,
        updatedAt: permissions.updatedAt,
        createdBy: permissions.createdBy,
        updatedBy: permissions.updatedBy,
        metadata: permissions.metadata,
        action: permissions.action,
        subject: permissions.subject,
        conditions: permissions.conditions,
        description: permissions.description,
      })
      .from(roles)
      .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .innerJoin(
        permissions,
        eq(rolePermissions.permissionId, permissions.id),
      )
      .where(eq(roles.code, roleCode));

    return rows as PermissionEntity[];
  }

  async assignPermissionsToRole(
    roleId: string,
    permissionIds: string[],
  ): Promise<void> {
    await this.db
      .delete(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));

    if (permissionIds.length > 0) {
      await this.db.insert(rolePermissions).values(
        permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
      );
    }
  }
}
