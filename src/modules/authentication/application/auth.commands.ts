export interface LoginCommand {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RegisterCommand {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RefreshTokenCommand {
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
}
