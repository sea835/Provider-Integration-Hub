export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string; // ví dụ: '15m'
  jwtExpiresInSeconds: number; // ví dụ: 900
  refreshSecret: string;
  refreshExpiresIn: string; // ví dụ: '7d'
  refreshExpiresInDays: number; // ví dụ: 7
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
