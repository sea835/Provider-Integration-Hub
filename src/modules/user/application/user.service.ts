import { Injectable, Inject } from '@nestjs/common';
import { BaseService } from '@common/base/base.service';
import { LoggerPort, LogLayer } from '@common/logger';
import { UserEntity } from '@modules/user/domain/user.entity';
import { UserRepositoryPort } from '@modules/user/domain/user.repository.port';
import * as crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);

@Injectable()
export class UserService extends BaseService<UserEntity> {
  private readonly logger: LoggerPort;

  constructor(
    @Inject(UserRepositoryPort)
    userRepository: UserRepositoryPort,
    logger: LoggerPort,
  ) {
    super(userRepository);
    this.logger = logger.child(LogLayer.APPLICATION, 'User', UserService.name);
  }

  static async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  static async verifyPassword(
    password: string,
    storedHash: string,
  ): Promise<boolean> {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    const computedHash = derivedKey.toString('hex');
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(computedHash, 'hex'),
    );
  }

  override async create(createDto: Partial<UserEntity>): Promise<UserEntity> {
    const data = { ...createDto };
    if (data.password) {
      data.password = await UserService.hashPassword(data.password);
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
      data.password = await UserService.hashPassword(data.password);
    }
    const user = await super.update(id, data);
    this.logger.info('User updated', { userId: user.id });
    return user;
  }
}
