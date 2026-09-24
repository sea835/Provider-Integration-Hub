import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from '@common/base/base.repository';
import { UserEntity } from '@modules/user/domain/user.entity';
import { users } from '@modules/user/infrastructure/user.schema';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';

@Injectable()
export class UserRepository extends BaseRepository<UserEntity> {
    constructor(
        @Inject(DRIZZLE) db: NodePgDatabase
    ) {
        super(db, users);
    }
}
