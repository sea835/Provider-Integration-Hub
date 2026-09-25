import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { AuthResponseDto } from '@modules/authentication/presentation/dto/auth.response';
import { ApiErrorResponse } from '@common/filters/error-response.interface';
import { UserResponseDto } from '@modules/user/presentation/dto/user.response';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  const testEmail = `auth-e2e-${Date.now()}@example.com`;
  const testPassword = 'StrongPassword123!';
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('nên đăng ký tài khoản mới thành công và trả về cặp tokens', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(201);

      const body = response.body as AuthResponseDto;
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body).toHaveProperty('expiresIn');
      expect(body.user.email).toBe(testEmail);
      expect(body.user.role).toBe('USER');
      expect((body.user as Record<string, unknown>).password).toBeUndefined();

      accessToken = body.accessToken;
      refreshToken = body.refreshToken;
    });

    it('nên trả về 409 Conflict khi đăng ký lại email đã tồn tại', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(409);

      const body = response.body as ApiErrorResponse;
      expect(body.statusCode).toBe(409);
      expect(body.error).toBe('Conflict');
    });

    it('nên trả về 400 khi client tự gửi role (không cho tự đăng ký ADMIN)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `self-admin-${Date.now()}@example.com`,
          password: testPassword,
          role: 'ADMIN',
        })
        .expect(400);

      const body = response.body as ApiErrorResponse;
      expect(body.message).toContain('property role should not exist');
    });

    it('nên trả về 400 Bad Request khi mật khẩu dưới 6 ký tự', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `invalid-${Date.now()}@example.com`,
          password: '123',
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('nên đăng nhập thành công với thông tin chính xác', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      const body = response.body as AuthResponseDto;
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.user.email).toBe(testEmail);

      // Cập nhật lại tokens mới nhất
      accessToken = body.accessToken;
      refreshToken = body.refreshToken;
    });

    it('nên trả về 401 khi sai mật khẩu (chống User Enumeration)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword999!',
        })
        .expect(401);

      const body = response.body as ApiErrorResponse;
      expect(body.statusCode).toBe(401);
      expect(body.message).toBe('Email hoặc mật khẩu không chính xác');
    });

    it('nên trả về 401 khi email không tồn tại (chống User Enumeration)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent-user@example.com',
          password: testPassword,
        })
        .expect(401);

      const body = response.body as ApiErrorResponse;
      expect(body.statusCode).toBe(401);
      expect(body.message).toBe('Email hoặc mật khẩu không chính xác');
    });
  });

  describe('GET /auth/me (Protected Route)', () => {
    it('nên trả về 401 khi không truyền Bearer token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('nên trả về 401 khi truyền token sai định dạng', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('nên trả về thông tin người dùng khi truyền Bearer token hợp lệ', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as UserResponseDto;
      expect(body.email).toBe(testEmail);
      expect(body.role).toBe('USER');
      expect((body as Record<string, unknown>).password).toBeUndefined();
    });
  });

  describe('POST /auth/refresh', () => {
    it('nên xoay vòng token thành công và trả về cặp token mới', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const body = response.body as AuthResponseDto;
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.refreshToken).not.toBe(refreshToken); // Refresh Token Rotation

      accessToken = body.accessToken;
      refreshToken = body.refreshToken;

      // Kiểm tra token mới hoạt động tốt
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  describe('POST /auth/logout', () => {
    it('nên đăng xuất thành công và vô hiệu hóa phiên làm việc', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Thử dùng lại refresh token cũ -> phải bị từ chối 401 vì session đã bị revoked
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });
});
