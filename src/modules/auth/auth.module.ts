import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '@modules/user/user.module';
import { AuthController } from '@modules/auth/presentation/auth.controller';
import { AuthService } from '@modules/auth/application/auth.service';
import { TokenPort } from '@modules/auth/domain/token.port';
import { JwtTokenAdapter } from '@modules/auth/infrastructure/jwt-token.adapter';
import { SessionRepositoryPort } from '@modules/auth/domain/session.repository.port';
import { SessionRepository } from '@modules/auth/infrastructure/session.repository';
import { JwtAuthGuard } from '@modules/auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/presentation/guards/roles.guard';

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
    RolesGuard,
  ],
  exports: [
    AuthService,
    TokenPort,
    SessionRepositoryPort,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
