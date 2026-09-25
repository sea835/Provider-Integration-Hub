import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '@modules/user/user.module';
import { AuthController } from '@modules/authentication/presentation/auth.controller';
import { AuthService } from '@modules/authentication/application/auth.service';
import { TokenPort } from '@modules/authentication/domain/token.port';
import { JwtTokenAdapter } from '@modules/authentication/infrastructure/jwt-token.adapter';
import { SessionRepositoryPort } from '@modules/authentication/domain/session.repository.port';
import { SessionRepository } from '@modules/authentication/infrastructure/session.repository';
import { JwtAuthGuard } from '@modules/authentication/presentation/guards/jwt-auth.guard';

@Module({
  imports: [JwtModule.register({}), UserModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: TokenPort,
      useClass: JwtTokenAdapter,
    },
    {
      provide: SessionRepositoryPort,
      useClass: SessionRepository,
    },
    JwtAuthGuard,
  ],
  exports: [
    AuthService,
    TokenPort,
    SessionRepositoryPort,
    JwtAuthGuard,
  ],
})
export class AuthenticationModule {}
