import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { ApiErrorResponse } from '@common/filters/error-response.interface';
import { UserResponseDto } from '@modules/user/presentation/dto/user.response';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let createdUserId: string;
  const uniqueEmail = `e2e-test-${Date.now()}@example.com`;

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

  describe('GET /users', () => {
    it('nên trả về 200 và header x-request-id', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /users (Validation Error & GlobalExceptionFilter)', () => {
    it('nên trả về 400 Bad Request theo đúng cấu trúc ApiErrorResponse khi payload không hợp lệ', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'invalid-email-format',
          password: '123', // ít hơn 6 ký tự
        })
        .expect(400);

      const body = response.body as ApiErrorResponse;
      expect(body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        path: '/users',
      });
      expect(Array.isArray(body.message)).toBe(true);
      expect(body.requestId).toBeDefined();
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('POST /users (Create User)', () => {
    it('nên tạo người dùng thành công, băm mật khẩu và KHÔNG để lộ password', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          email: uniqueEmail,
          password: 'SecurePassword123!',
        })
        .expect(201);

      const body = response.body as UserResponseDto & { password?: string };
      expect(body).toHaveProperty('id');
      expect(body.email).toBe(uniqueEmail);
      expect(body.status).toBe('ACTIVE');
      expect(body.password).toBeUndefined(); // Tuyệt đối không lộ password

      createdUserId = body.id;
    });

    it('nên trả về 409 Conflict khi tạo người dùng trùng email', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          email: uniqueEmail,
          password: 'AnotherPassword123!',
        })
        .expect(409);

      const body = response.body as ApiErrorResponse;
      expect(body).toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        path: '/users',
      });
      expect(typeof body.message).toBe('string');
      expect(body.message).toContain('đã tồn tại trong hệ thống');
    });
  });

  describe('GET /users/:id', () => {
    it('nên lấy thông tin chi tiết người dùng vừa tạo', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${createdUserId}`)
        .expect(200);

      const body = response.body as UserResponseDto & { password?: string };
      expect(body.id).toBe(createdUserId);
      expect(body.email).toBe(uniqueEmail);
      expect(body.password).toBeUndefined();
    });

    it('nên trả về 404 NotFound nếu user id không tồn tại', async () => {
      const nonExistentId = '01920000-0000-7000-8000-000000000000';
      const response = await request(app.getHttpServer())
        .get(`/users/${nonExistentId}`)
        .expect(404);

      const body = response.body as ApiErrorResponse;
      expect(body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        path: `/users/${nonExistentId}`,
      });
    });
  });

  describe('PATCH /users/:id', () => {
    it('nên cập nhật thông tin người dùng thành công', async () => {
      const updatedEmail = `updated-${Date.now()}@example.com`;
      const response = await request(app.getHttpServer())
        .patch(`/users/${createdUserId}`)
        .send({ email: updatedEmail })
        .expect(200);

      const body = response.body as UserResponseDto;
      expect(body.id).toBe(createdUserId);
      expect(body.email).toBe(updatedEmail);
    });
  });

  describe('DELETE /users/:id', () => {
    it('nên xóa người dùng thành công và sau đó query trả về 404', async () => {
      await request(app.getHttpServer())
        .delete(`/users/${createdUserId}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/users/${createdUserId}`)
        .expect(404);
    });
  });
});
