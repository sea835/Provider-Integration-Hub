import { Injectable, Inject } from '@nestjs/common';
import { BaseService } from '@common/base/base.service';
import { LoggerPort, LogLayer } from '@common/logger';
import { UserEntity } from '@modules/user/domain/user.entity';
import { UserRepository } from '@modules/user/infrastructure/user.repository';

@Injectable()
export class UserService extends BaseService<UserEntity> {
    private readonly logger: LoggerPort;

    constructor(
        @Inject('IUserRepository')
        private readonly userRepository: UserRepository,
        logger: LoggerPort,
    ) {
        super(userRepository);
        this.logger = logger.child(LogLayer.APPLICATION, 'User', UserService.name);
    }
}
