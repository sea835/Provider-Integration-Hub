import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import {
  LivenessResponseDto,
  ReadinessResponseDto,
} from '@modules/health/presentation/dto/health.response';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health/live', () => {
    it('nên trả về 200 mà không cần access token', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      const body = response.body as LivenessResponseDto;
      expect(body.status).toBe('ok');
      expect(typeof body.uptimeSeconds).toBe('number');
    });

    it('không bị giới hạn bởi rate limit', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
    });
  });

  describe('GET /health/ready', () => {
    it('nên trả về 200 và database up khi DB đang chạy', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);

      const body = response.body as ReadinessResponseDto;
      expect(body.status).toBe('ok');
      expect(body.checks.database.status).toBe('up');
      expect(typeof body.checks.database.latencyMs).toBe('number');
    });
  });
});
