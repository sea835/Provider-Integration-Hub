import { Module } from '@nestjs/common';
import { DrizzleModule } from '@infrastructure/database/drizzle.module';
import { UserModule } from '@modules/user/user.module';

@Module({
  imports: [DrizzleModule, UserModule],
  controllers: [],
  providers: [],
})
export class AppModule {}

