export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  sessionId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
