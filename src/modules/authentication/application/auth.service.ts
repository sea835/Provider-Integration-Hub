import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { LoggerPort, LogLayer } from '@common/logger';
import { UserRepositoryPort } from '@modules/user/domain/user.repository.port';
import { UserService } from '@modules/user/application/user.service';
import { Role } from '@modules/user/domain/user-role';
import { UserResponseDto } from '@modules/user/presentation/dto/user.response';
import { TokenPort } from '@modules/auth/domain/token.port';
import { SessionRepositoryPort } from '@modules/auth/domain/session.repository.port';
import {
  LoginCommand,
  RegisterCommand,
  RefreshTokenCommand,
} from '@modules/auth/application/auth.commands';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserResponseDto;
}

@Injectable()
export class AuthService {
  private readonly logger: LoggerPort;

  constructor(
    private readonly userRepository: UserRepositoryPort,
    private readonly sessionRepository: SessionRepositoryPort,
    private readonly tokenPort: TokenPort,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(LogLayer.APPLICATION, 'Auth', AuthService.name);
  }

  async register(cmd: RegisterCommand): Promise<AuthResult> {
    const existing = await this.userRepository.findByEmail(cmd.email);
    if (existing) {
      throw new ConflictException('Email đã tồn tại trong hệ thống');
    }

    // Tự đăng ký luôn là USER; quyền cao hơn chỉ ADMIN cấp qua /users hoặc script db:seed:admin
    const hashedPassword = await UserService.hashPassword(cmd.password);
    const user = await this.userRepository.create({
      email: cmd.email,
      password: hashedPassword,
      role: Role.USER,
      status: 'ACTIVE',
    });

    this.logger.info('User registered successfully', {
      userId: user.id,
      email: user.email,
    });

    return this.createSessionAndIssueTokens(
      user.id,
      user.email,
      user.role || 'USER',
      cmd.ipAddress,
      cmd.userAgent,
    );
  }

  async login(cmd: LoginCommand): Promise<AuthResult> {
    const user = await this.userRepository.findByEmail(cmd.email);

    // Chống User Enumeration: dù sai email hay sai password đều trả về cùng một thông điệp
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const isPasswordValid = await UserService.verifyPassword(
      cmd.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // Kiểm tra trạng thái tài khoản
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Tài khoản của bạn đã bị vô hiệu hóa hoặc tạm khóa',
      );
    }

    this.logger.info('User authenticated successfully', { userId: user.id });

    return this.createSessionAndIssueTokens(
      user.id,
      user.email,
      user.role || 'USER',
      cmd.ipAddress,
      cmd.userAgent,
    );
  }

  async refreshToken(cmd: RefreshTokenCommand): Promise<AuthResult> {
    const payload = await this.tokenPort.verifyRefreshToken(cmd.refreshToken);
    if (!payload.sessionId) {
      throw new UnauthorizedException('Refresh Token không hợp lệ');
    }

    const session = await this.sessionRepository.findValidSession(
      payload.sessionId,
    );
    if (!session || session.isRevoked) {
      throw new UnauthorizedException(
        'Phiên làm việc đã hết hạn hoặc đã bị thu hồi',
      );
    }

    const isMatch = await UserService.verifyPassword(
      cmd.refreshToken,
      session.refreshTokenHash,
    );
    if (!isMatch) {
      throw new UnauthorizedException('Refresh Token không hợp lệ');
    }

    const user = await this.userRepository.findById(session.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa',
      );
    }

    // Thu hồi session cũ (Refresh Token Rotation)
    await this.sessionRepository.revokeSession(session.id);

    this.logger.info('Refresh token rotated successfully', { userId: user.id });

    // Tạo session mới và cấp cặp token mới
    return this.createSessionAndIssueTokens(
      user.id,
      user.email,
      user.role || 'USER',
      cmd.ipAddress || session.ipAddress || undefined,
      cmd.userAgent || session.userAgent || undefined,
    );
  }

  async logout(sessionId?: string, userId?: string): Promise<boolean> {
    if (sessionId) {
      await this.sessionRepository.revokeSession(sessionId);
      this.logger.info('Session revoked', { sessionId });
      return true;
    }
    if (userId) {
      await this.sessionRepository.revokeAllUserSessions(userId);
      this.logger.info('All sessions revoked for user', { userId });
      return true;
    }
    return false;
  }

  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }
    return UserResponseDto.fromEntity(user);
  }

  private async createSessionAndIssueTokens(
    userId: string,
    email: string,
    role: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    const sessionId = uuidv7();
    const tokens = await this.tokenPort.generateTokens({
      sub: userId,
      email,
      role,
      sessionId,
    });

    const refreshTokenHash = await UserService.hashPassword(
      tokens.refreshToken,
    );
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 ngày

    await this.sessionRepository.create({
      id: sessionId,
      userId,
      refreshTokenHash,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      expiresAt,
      isRevoked: false,
    });

    const user = await this.userRepository.findById(userId);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: UserResponseDto.fromEntity(user!),
    };
  }
}
