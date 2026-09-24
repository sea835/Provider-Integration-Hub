import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
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

  it('/users (GET) should return 200 and x-request-id header', async () => {
    const response = await request(app.getHttpServer())
      .get('/users')
      .expect(200);

    expect(response.headers['x-request-id']).toBeDefined();
    expect(Array.isArray(response.body)).toBe(true);
  });
});
