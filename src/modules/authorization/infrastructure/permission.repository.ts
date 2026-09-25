import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { BaseRepository } from '@common/base/base.repository';
import { PermissionEntity } from '../domain/permission.entity';
import { PermissionRepositoryPort } from '../domain/permission.repository.port';
import { permissions } from './authorization.schema';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';

@Injectable()
export class PermissionRepository
  extends BaseRepository<PermissionEntity>
  implements PermissionRepositoryPort
{
  constructor(@Inject(DRIZZLE) db: NodePgDatabase) {
    super(db, permissions);
  }

  async findByActionAndSubject(
    action: string,
    subject: string,
  ): Promise<PermissionEntity | null> {
    const result = (await this.db
      .select()
      .from(permissions)
      .where(
        and(eq(permissions.action, action), eq(permissions.subject, subject)),
      )) as PermissionEntity[];
    return result[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(permissions)
      .where(eq(permissions.id, id))
      .returning();
    return result.length > 0;
  }
}
