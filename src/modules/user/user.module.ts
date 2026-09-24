import { Module } from '@nestjs/common';
import { UserController } from './presentation/user.controller';
import { UserService } from './application/user.service';
import { UserRepository } from './infrastructure/user.repository';
import { DrizzleModule } from '@infrastructure/database/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [UserController],
  providers: [
    UserService,
    {
      provide: 'IUserRepository',
      useClass: UserRepository,
    },
  ],
  exports: [UserService],
})
export class UserModule {}
