import { BaseRepositoryPort } from '@common/base/base.repository.port';
import { UserEntity } from '@modules/user/domain/user.entity';

export abstract class UserRepositoryPort extends BaseRepositoryPort<UserEntity> {
  abstract findByEmail(email: string): Promise<UserEntity | null>;
}
