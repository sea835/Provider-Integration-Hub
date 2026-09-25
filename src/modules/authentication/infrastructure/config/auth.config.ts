export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtExpiresInSeconds: number;
  refreshSecret: string;
  refreshExpiresIn: string;
  refreshExpiresInDays: number;
}

export function loadAuthConfig(): AuthConfig {
  return {
    jwtSecret:
      process.env.JWT_SECRET || 'super-secret-jwt-key-provider-integration-hub',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    jwtExpiresInSeconds: parseInt(process.env.JWT_EXPIRES_IN_SEC || '900', 10),
    refreshSecret:
      process.env.REFRESH_JWT_SECRET ||
      'super-secret-refresh-jwt-key-provider-integration-hub',
    refreshExpiresIn: process.env.REFRESH_JWT_EXPIRES_IN || '7d',
    refreshExpiresInDays: parseInt(
      process.env.REFRESH_EXPIRES_IN_DAYS || '7',
      10,
    ),
  };
}
