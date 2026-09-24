import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { ApiErrorResponse } from '@common/filters/error-response.interface';
import { UserResponseDto } from '@modules/user/presentation/dto/user.response';
import { AuthResponseDto } from '@modules/auth/presentation/dto/auth.response';
import { UserRepositoryPort } from '@modules/user/domain/user.repository.port';
import { UserService } from '@modules/user/application/user.service';
import { Role } from '@modules/user/domain/user-role';

describe('UserController (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: UserRepositoryPort;
  let adminId: string;
  let adminToken: string;
  let normalUserToken: string;
  let normalUserId: string;
  let createdUserId: string;
  const runId = Date.now();
  const uniqueEmail = `e2e-test-${runId}@example.com`;
  const adminPassword = 'AdminPassword123!';

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

    // ADMIN không tự đăng ký được → tạo thẳng qua repository, giống script db:seed:admin
    userRepository = app.get(UserRepositoryPort);
    const admin = await userRepository.create({
      email: `e2e-admin-${runId}@example.com`,
      password: await UserService.hashPassword(adminPassword),
      role: Role.ADMIN,
      status: 'ACTIVE',
    });
    adminId = admin.id;

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: admin.email, password: adminPassword })
      .expect(200);
    adminToken = (adminLogin.body as AuthResponseDto).accessToken;

    const normalUser = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `e2e-user-${runId}@example.com`, password: 'User123!' })
      .expect(201);
    normalUserToken = (normalUser.body as AuthResponseDto).accessToken;
    normalUserId = (normalUser.body as AuthResponseDto).user.id;
  });

  afterAll(async () => {
    await userRepository.delete(adminId);
    await userRepository.delete(normalUserId);
    await app.close();
  });

  describe('Phân quyền', () => {
    it('nên trả về 401 khi không có access token', async () => {
      await request(app.getHttpServer()).get('/users').expect(401);
    });

    it('nên trả về 403 khi token thuộc role USER', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(403);

      const body = response.body as ApiErrorResponse;
      expect(body.message).toBe('Bạn không có quyền thực hiện hành động này');
    });

    it('nên trả về 403 khi USER cố xoá người dùng khác', async () => {
      await request(app.getHttpServer())
        .delete(`/users/${adminId}`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(403);
    });
  });

  describe('GET /users', () => {
    it('nên trả về 200 và header x-request-id', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /users (Validation Error & GlobalExceptionFilter)', () => {
    it('nên trả về 400 Bad Request theo đúng cấu trúc ApiErrorResponse khi payload không hợp lệ', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
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

    it('nên trả về 400 khi role không hợp lệ', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `invalid-role-${runId}@example.com`,
          password: 'SecurePassword123!',
          role: 'SUPERADMIN',
        })
        .expect(400);
    });
  });

  describe('POST /users (Create User)', () => {
    it('nên tạo người dùng thành công, băm mật khẩu và KHÔNG để lộ password', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: uniqueEmail,
          password: 'SecurePassword123!',
        })
        .expect(201);

      const body = response.body as UserResponseDto & { password?: string };
      expect(body).toHaveProperty('id');
      expect(body.email).toBe(uniqueEmail);
      expect(body.status).toBe('ACTIVE');
      expect(body.role).toBe('USER');
      expect(body.password).toBeUndefined(); // Tuyệt đối không lộ password

      createdUserId = body.id;
    });

    it('nên trả về 409 Conflict khi tạo người dùng trùng email', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
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
        .set('Authorization', `Bearer ${adminToken}`)
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
        .set('Authorization', `Bearer ${adminToken}`)
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
    it('nên cập nhật email và role của người dùng thành công', async () => {
      const updatedEmail = `updated-${runId}@example.com`;
      const response = await request(app.getHttpServer())
        .patch(`/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: updatedEmail, role: 'MANAGER' })
        .expect(200);

      const body = response.body as UserResponseDto;
      expect(body.id).toBe(createdUserId);
      expect(body.email).toBe(updatedEmail);
      expect(body.role).toBe('MANAGER');
    });
  });

  describe('DELETE /users/:id', () => {
    it('nên xóa người dùng thành công và sau đó query trả về 404', async () => {
      await request(app.getHttpServer())
        .delete(`/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
