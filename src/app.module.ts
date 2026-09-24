import { Module } from '@nestjs/common';
import { LoggerModule } from '@infrastructure/logger/logger.module';
import { DrizzleModule } from '@infrastructure/database/drizzle.module';
import { UserModule } from '@modules/user/user.module';

@Module({
  imports: [LoggerModule, DrizzleModule, UserModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
