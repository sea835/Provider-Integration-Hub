export interface TokenPayload {
  sub: string; // userId (UUIDv7)
  email: string;
  role: string;
  sessionId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // thời gian sống tính bằng giây
}
