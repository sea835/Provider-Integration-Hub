# Triển Khai

Build image, chạy migration ở môi trường thật, pipeline CI và các lưu ý vận hành.

---

## 1. Tổng Quan

| Mục | Hiện trạng |
|---|---|
| Đóng gói | Docker image multi-stage (`Dockerfile`) |
| CI | GitHub Actions (`.github/workflows/ci.yml`): lint → unit test → migrate → E2E → build |
| CD (build/push image, deploy) | **Chưa có** |
| Health check endpoint | **Chưa có** |
| Trạng thái của app | Stateless, trừ bộ đếm rate limit lưu trong bộ nhớ |

---

## 2. Docker Image

`Dockerfile` gồm hai stage:

| Stage | Base | Việc làm |
|---|---|---|
| `builder` | `node:22-alpine` | `npm ci` → `npm run build` → `npm prune --production` |
| `runner` | `node:22-alpine` | Chạy bằng user `node`, chỉ chứa `package*.json`, `node_modules` (production) và `dist/`; `NODE_ENV=production`, `PORT=3000`, `CMD node dist/main` |

Build và chạy:

```bash
docker build -t provider-integration-hub:<version> .

docker run -d --name pih \
  -p 3000:3000 \
  --env-file .env.production \
  provider-integration-hub:<version>
```

- `.env` bị loại khỏi build context (`.dockerignore`), nên cấu hình **phải truyền lúc chạy** (`--env-file`, `-e`, hoặc secret của orchestrator).
- Biến bắt buộc ở production: `DATABASE_URL`, `JWT_SECRET`, `REFRESH_JWT_SECRET`. Danh sách đầy đủ: [CONFIGURATION.md](./CONFIGURATION.md).
- `docker-compose.yml` chỉ chứa PostgreSQL cho local, **không** dùng cho production (mật khẩu mẫu, không có service app).

---

## 3. Migration Ở Môi Trường Thật

`npm run db:migrate` chạy `tsx src/infrastructure/database/migrate.ts` — **không dùng được trong image production** vì image không có `tsx` (devDependency đã bị prune), thư mục `src/`, hay thư mục `drizzle/migrations/`.

### Cách A — Chạy từ pipeline (dùng được ngay)

Trong job deploy, trước khi chuyển traffic sang phiên bản mới:

```bash
npm ci
DATABASE_URL=<production url> npm run db:migrate
```

### Cách B — Chạy từ chính image (đề xuất)

`migrate.ts` đã được build sẵn thành `dist/infrastructure/database/migrate.js`; chỉ thiếu file SQL. Thêm vào stage `runner` của `Dockerfile`:

```dockerfile
COPY --chown=node:node --from=builder /usr/src/app/drizzle ./drizzle
```

Rồi chạy như một job/init container trước khi khởi động app:

```bash
docker run --rm --env-file .env.production provider-integration-hub:<version> \
  node dist/infrastructure/database/migrate.js
```

### Nguyên tắc

- **Migrate trước, deploy code sau.** Migration phải tương thích với phiên bản đang chạy (thêm cột nullable / có default trước, xoá cột ở một release sau).
- Drizzle không có migration ngược. Rollback code thì giữ nguyên DB; sửa schema sai bằng migration mới.
- Chạy migration trên staging trước production. Backup DB trước migration có `DROP` hoặc đổi kiểu.
- Chỉ một tiến trình chạy migration tại một thời điểm.

Quy trình chi tiết: [huong-dan-migration.md](huong-dan/huong-dan-migration.md).

---

## 4. CI

Chạy khi push hoặc mở PR vào `main`, `master`, `develop`:

| Bước | Lệnh | Ghi chú |
|---|---|---|
| Cài đặt | `npm ci` | Node 22, cache npm |
| Lint | `npm run lint` | Có `--fix`, nhưng thay đổi không được commit lại — lỗi không tự sửa được sẽ làm fail |
| Unit test | `npm run test` | |
| Migration | `npm run db:migrate` | Vào service `postgres:16-alpine` của job |
| E2E | `npm run test:e2e` | Dùng DB vừa migrate |
| Build | `npm run build` | Chỉ kiểm tra build được, **không** build/push image |

CI không đặt `JWT_SECRET` → test chạy với secret mặc định trong code (chấp nhận được cho CI).

---

## 5. Vận Hành

### Khởi động và dừng

- App lắng nghe `PORT` (mặc định 3000), chạy với user `node` (không phải root).
- `enableShutdownHooks()` bật: khi nhận `SIGTERM`, Nest gọi `onApplicationShutdown` → đóng pool PostgreSQL.
- App **dừng ngay khi khởi động** nếu thiếu `DATABASE_URL`. Sai thông tin kết nối DB **không** làm app dừng lúc khởi động — lỗi chỉ lộ ra ở request đầu tiên chạm DB (pool kết nối lười).

### Health check

Chưa có endpoint health. Trong lúc chờ bổ sung (`GET /health` kiểm tra `SELECT 1`), dùng TCP probe trên cổng 3000 cho liveness. Không dùng `/docs` làm health check: trang này không phản ánh trạng thái DB.

### Mở rộng nhiều instance

| Vấn đề | Chi tiết | Xử lý |
|---|---|---|
| Rate limit | Bộ đếm `@nestjs/throttler` lưu trong bộ nhớ từng process → N instance thì giới hạn thực tế ×N | Dùng storage Redis cho throttler |
| Kết nối DB | Mỗi instance mở tối đa 20 kết nối | Đảm bảo `số instance × 20` < `max_connections` của PostgreSQL (mặc định 100), chừa chỗ cho migration và công cụ quản trị |
| IP client sau proxy | `req.ip` là IP của proxy nếu chưa cấu hình `trust proxy` → mọi client chung một hạn mức rate limit | Cấu hình `trust proxy` (xem [SECURITY.md](./SECURITY.md) R5) |
| Session | Lưu trong PostgreSQL | Không cần sticky session |

### Log

- Production mặc định `LOG_FORMAT=json`, mỗi dòng một object JSON: `time`, `level`, `tags`, `requestId`, `msg`, `meta`, `err`.
- `info` / `debug` / `verbose` ghi ra **stdout**; `warn` / `error` ghi ra **stderr**. Thu thập cả hai luồng.
- Truy vết sự cố bằng `requestId` (trùng header `x-request-id` trả về cho client).

---

## 6. Checklist Triển Khai

**Trước lần triển khai production đầu tiên**

- [ ] Checklist bảo mật trong [SECURITY.md](./SECURITY.md) mục 7 đã hoàn tất.
- [ ] Có cách chạy migration ở môi trường thật (mục 3).
- [ ] Có health check và probe tương ứng.
- [ ] Log được thu thập tập trung.
- [ ] DB có backup tự động và đã thử khôi phục.

**Mỗi lần triển khai**

- [ ] CI xanh trên commit sẽ triển khai.
- [ ] Đã đọc SQL của migration mới; migration tương thích với phiên bản đang chạy.
- [ ] Migration chạy thành công trên staging.
- [ ] Chạy migration production → triển khai image mới → kiểm tra `POST /auth/login` và một endpoint có đọc DB.
- [ ] Theo dõi log `error` trong 15 phút đầu.

**Rollback**

- [ ] Triển khai lại image của phiên bản trước (DB giữ nguyên).
- [ ] Nếu migration gây lỗi: viết migration bù trừ, không sửa/xoá file migration đã chạy.
