import { TokenPayload, AuthTokens } from '@modules/auth/domain/auth-token.vo';

/**
 * Output Port cho việc ký và giải mã JWT token (Hexagonal Architecture).
 * Tầng Domain & Application chỉ giao tiếp qua abstract class này.
 */
export abstract class TokenPort {
  abstract generateTokens(payload: TokenPayload): Promise<AuthTokens>;
  abstract verifyAccessToken(token: string): Promise<TokenPayload>;
  abstract verifyRefreshToken(token: string): Promise<TokenPayload>;
}
