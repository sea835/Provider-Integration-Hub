import { TokenPayload, AuthTokens } from '@modules/authentication/domain/auth-token.vo';

export abstract class TokenPort {
  abstract generateTokens(payload: TokenPayload): Promise<AuthTokens>;
  abstract verifyAccessToken(token: string): Promise<TokenPayload>;
  abstract verifyRefreshToken(token: string): Promise<TokenPayload>;
}
