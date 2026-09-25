import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from '@modules/auth/application/auth.service';
import { Public } from '@modules/auth/presentation/decorators/public.decorator';
import { CurrentUser } from '@modules/auth/presentation/decorators/current-user.decorator';
import type { TokenPayload } from '@modules/auth/domain/auth-token.vo';
import { LoginRequestDto } from '@modules/auth/presentation/dto/login.request';
import { RegisterRequestDto } from '@modules/auth/presentation/dto/register.request';
import { RefreshTokenRequestDto } from '@modules/auth/presentation/dto/refresh-token.request';
import { AuthResponseDto } from '@modules/auth/presentation/dto/auth.response';
import { UserResponseDto } from '@modules/user/presentation/dto/user.response';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản mới' })
  async register(
    @Body() dto: RegisterRequestDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip;
    const userAgent = req.headers['user-agent'];
    return this.authService.register({
      ...dto,
      ipAddress,
      userAgent,
    });
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập vào hệ thống' })
  async login(
    @Body() dto: LoginRequestDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip;
    const userAgent = req.headers['user-agent'];
    return this.authService.login({
      ...dto,
      ipAddress,
      userAgent,
    });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Làm mới Access Token' })
  async refresh(
    @Body() dto: RefreshTokenRequestDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip;
    const userAgent = req.headers['user-agent'];
    return this.authService.refreshToken({
      ...dto,
      ipAddress,
      userAgent,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({ summary: 'Đăng xuất khỏi phiên hiện tại' })
  async logout(
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: boolean }> {
    const success = await this.authService.logout(user?.sessionId, user?.sub);
    return { success };
  }

  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin tài khoản hiện tại' })
  async getProfile(
    @CurrentUser('sub') userId: string,
  ): Promise<UserResponseDto> {
    return this.authService.getProfile(userId);
  }
}
