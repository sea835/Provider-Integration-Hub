import { Module } from '@nestjs/common';
import { UserController } from '@modules/user/presentation/user.controller';
import { UserService } from '@modules/user/application/user.service';
import { UserRepository } from '@modules/user/infrastructure/user.repository';
import { UserRepositoryPort } from '@modules/user/domain/user.repository.port';
import { DrizzleModule } from '@infrastructure/database/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [UserController],
  providers: [
    UserService,
    {
      provide: UserRepositoryPort,
      useClass: UserRepository,
    },
    {
      provide: 'IUserRepository',
      useExisting: UserRepositoryPort,
    },
  ],
  exports: [UserService, UserRepositoryPort],
})
export class UserModule {}
