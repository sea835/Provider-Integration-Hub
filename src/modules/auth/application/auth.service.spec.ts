import {
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '@modules/auth/application/auth.service';
import { UserRepositoryPort } from '@modules/user/domain/user.repository.port';
import { SessionRepositoryPort } from '@modules/auth/domain/session.repository.port';
import { TokenPort } from '@modules/auth/domain/token.port';
import { LoggerPort } from '@common/logger';
import { UserService } from '@modules/user/application/user.service';
import { UserEntity } from '@modules/user/domain/user.entity';
import { SessionEntity } from '@modules/auth/domain/session.entity';

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: Record<string, jest.Mock>;
  let sessionRepository: Record<string, jest.Mock>;
  let tokenPort: Record<string, jest.Mock>;
  let logger: Record<string, jest.Mock>;

  const mockUser: UserEntity = {
    id: '0192f3a1-8e9a-7c3d-b4ef-123456789abc',
    email: 'test@example.com',
    password: '', // will be set in beforeEach
    role: 'USER',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    metadata: null,
  };

  const mockSession: SessionEntity = {
    id: '0192f3a1-9999-7c3d-b4ef-123456789abc',
    userId: mockUser.id,
    refreshTokenHash: '', // will be set in beforeEach
    ipAddress: '127.0.0.1',
    userAgent: 'Jest Test Agent',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isRevoked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const rawPassword = 'ValidPassword123!';
    const hashedPassword = await UserService.hashPassword(rawPassword);
    mockUser.password = hashedPassword;

    const rawRefreshToken = 'valid-refresh-token';
    const hashedRefreshToken = await UserService.hashPassword(rawRefreshToken);
    mockSession.refreshTokenHash = hashedRefreshToken;

    userRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      search: jest.fn(),
    };

    sessionRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findValidSession: jest.fn(),
      revokeSession: jest.fn(),
      revokeAllUserSessions: jest.fn(),
      cleanExpiredSessions: jest.fn(),
    };

    tokenPort = {
      generateTokens: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
    };

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn().mockReturnThis(),
    };

    authService = new AuthService(
      userRepository as unknown as UserRepositoryPort,
      sessionRepository as unknown as SessionRepositoryPort,
      tokenPort as unknown as TokenPort,
      logger as unknown as LoggerPort,
    );
  });

  describe('register', () => {
    it('nên đăng ký tài khoản thành công và trả về cặp tokens', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue({
        ...mockUser,
        id: '0192f3a1-8e9a-7c3d-b4ef-123456789abc',
      });
      userRepository.findById.mockResolvedValue(mockUser);
      tokenPort.generateTokens.mockResolvedValue({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresIn: 900,
      });

      const result = await authService.register({
        email: 'newuser@example.com',
        password: 'Password123!',
      });

      expect(result).toHaveProperty('accessToken', 'access-token-123');
      expect(result).toHaveProperty('refreshToken', 'refresh-token-123');
      expect(result.user.email).toBe(mockUser.email);
      expect(sessionRepository.create).toHaveBeenCalledTimes(1);
    });

    it('nên ném ConflictException khi email đã tồn tại', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(
        authService.register({
          email: mockUser.email,
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('nên đăng nhập thành công khi đúng thông tin', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);
      userRepository.findById.mockResolvedValue(mockUser);
      tokenPort.generateTokens.mockResolvedValue({
        accessToken: 'valid-access-token',
        refreshToken: 'valid-refresh-token',
        expiresIn: 900,
      });

      const result = await authService.login({
        email: mockUser.email,
        password: 'ValidPassword123!',
      });

      expect(result.accessToken).toBe('valid-access-token');
      expect(sessionRepository.create).toHaveBeenCalledTimes(1);
    });

    it('nên ném UnauthorizedException khi email không tồn tại (chống User Enumeration)', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'notfound@example.com',
          password: 'AnyPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('nên ném UnauthorizedException khi mật khẩu sai (chống User Enumeration)', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(
        authService.login({
          email: mockUser.email,
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('nên ném ForbiddenException khi tài khoản không ở trạng thái ACTIVE', async () => {
      userRepository.findByEmail.mockResolvedValue({
        ...mockUser,
        status: 'BLOCKED',
      });

      await expect(
        authService.login({
          email: mockUser.email,
          password: 'ValidPassword123!',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('refreshToken', () => {
    it('nên refresh token thành công và thu hồi session cũ', async () => {
      tokenPort.verifyRefreshToken.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        sessionId: mockSession.id,
      });
      sessionRepository.findValidSession.mockResolvedValue(mockSession);
      userRepository.findById.mockResolvedValue(mockUser);
      tokenPort.generateTokens.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
      });

      const result = await authService.refreshToken({
        refreshToken: 'valid-refresh-token',
      });

      expect(result.accessToken).toBe('new-access-token');
      expect(sessionRepository.revokeSession).toHaveBeenCalledWith(
        mockSession.id,
      );
      expect(sessionRepository.create).toHaveBeenCalledTimes(1);
    });

    it('nên ném UnauthorizedException nếu refresh token không có sessionId', async () => {
      tokenPort.verifyRefreshToken.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });

      await expect(
        authService.refreshToken({
          refreshToken: 'token-without-session-id',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('nên ném UnauthorizedException nếu phiên đã bị thu hồi hoặc không hợp lệ', async () => {
      tokenPort.verifyRefreshToken.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        sessionId: 'revoked-session-id',
      });
      sessionRepository.findValidSession.mockResolvedValue(null);

      await expect(
        authService.refreshToken({
          refreshToken: 'token-with-revoked-session',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('nên thu hồi session theo sessionId', async () => {
      sessionRepository.revokeSession.mockResolvedValue(undefined);

      const result = await authService.logout('session-id-123');
      expect(result).toBe(true);
      expect(sessionRepository.revokeSession).toHaveBeenCalledWith(
        'session-id-123',
      );
    });

    it('nên thu hồi tất cả sessions theo userId', async () => {
      sessionRepository.revokeAllUserSessions.mockResolvedValue(undefined);

      const result = await authService.logout(undefined, 'user-id-123');
      expect(result).toBe(true);
      expect(sessionRepository.revokeAllUserSessions).toHaveBeenCalledWith(
        'user-id-123',
      );
    });
  });

  describe('getProfile', () => {
    it('nên lấy profile thành công khi user tồn tại', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      const profile = await authService.getProfile(mockUser.id);
      expect(profile.id).toBe(mockUser.id);
      expect(profile.email).toBe(mockUser.email);
    });

    it('nên ném NotFoundException nếu user không tồn tại', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(authService.getProfile('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
