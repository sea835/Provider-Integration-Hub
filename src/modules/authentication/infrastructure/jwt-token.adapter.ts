import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenPort } from '@modules/authentication/domain/token.port';
import { TokenPayload, AuthTokens } from '@modules/authentication/domain/auth-token.vo';
import {
  AuthConfig,
  loadAuthConfig,
} from '@modules/authentication/infrastructure/config/auth.config';

@Injectable()
export class JwtTokenAdapter implements TokenPort {
  private readonly config: AuthConfig;

  constructor(private readonly jwtService: JwtService) {
    this.config = loadAuthConfig();
  }

  async generateTokens(payload: TokenPayload): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.jwtSecret,
        expiresIn: this.config.jwtExpiresInSeconds,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.refreshSecret,
        expiresIn: this.config.refreshExpiresInDays * 24 * 60 * 60,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.jwtExpiresInSeconds,
    };
  }

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      return await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.config.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException(
        'Access Token không hợp lệ hoặc đã hết hạn',
      );
    }
  }

  async verifyRefreshToken(token: string): Promise<TokenPayload> {
    try {
      return await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.config.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException(
        'Refresh Token không hợp lệ hoặc đã hết hạn',
      );
    }
  }
}
