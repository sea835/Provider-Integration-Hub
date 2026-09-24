import { Injectable, Inject } from '@nestjs/common';
import { BaseService } from '@common/base/base.service';
import { UserEntity } from '@modules/user/domain/user.entity';
import { UserRepository } from '@modules/user/infrastructure/user.repository';

@Injectable()
export class UserService extends BaseService<UserEntity> {
    constructor(
        @Inject('IUserRepository')
        private readonly userRepository: UserRepository,
    ) {
        super(userRepository);
    }
}
