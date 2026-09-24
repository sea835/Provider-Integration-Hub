import { Injectable, Inject } from '@nestjs/common';
import { BaseService } from '@common/base/base.service';
import { LoggerPort, LogLayer } from '@common/logger';
import { UserEntity } from '@modules/user/domain/user.entity';
import { UserRepository } from '@modules/user/infrastructure/user.repository';
import * as crypto from 'node:crypto';

@Injectable()
export class UserService extends BaseService<UserEntity> {
  private readonly logger: LoggerPort;

  constructor(
    @Inject('IUserRepository')
    userRepository: UserRepository,
    logger: LoggerPort,
  ) {
    super(userRepository);
    this.logger = logger.child(LogLayer.APPLICATION, 'User', UserService.name);
  }

  static hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  static verifyPassword(password: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(computedHash, 'hex'),
    );
  }

  override async create(createDto: Partial<UserEntity>): Promise<UserEntity> {
    const data = { ...createDto };
    if (data.password) {
      data.password = UserService.hashPassword(data.password);
    }
    const user = await super.create(data);
    this.logger.info('User created', { userId: user.id, email: user.email });
    return user;
  }

  override async update(
    id: string,
    updateDto: Partial<UserEntity>,
  ): Promise<UserEntity> {
    const data = { ...updateDto };
    if (data.password) {
      data.password = UserService.hashPassword(data.password);
    }
    const user = await super.update(id, data);
    this.logger.info('User updated', { userId: user.id });
    return user;
  }
}
