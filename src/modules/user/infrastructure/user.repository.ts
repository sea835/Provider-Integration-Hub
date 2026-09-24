import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { BaseRepository } from '@common/base/base.repository';
import { UserEntity } from '@modules/user/domain/user.entity';
import { UserRepositoryPort } from '@modules/user/domain/user.repository.port';
import { users } from '@modules/user/infrastructure/user.schema';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';

@Injectable()
export class UserRepository
  extends BaseRepository<UserEntity>
  implements UserRepositoryPort
{
  constructor(@Inject(DRIZZLE) db: NodePgDatabase) {
    super(db, users);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const result = (await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))) as UserEntity[];

    return result[0] || null;
  }
}
