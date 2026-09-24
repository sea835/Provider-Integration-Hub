# Provider Integration Hub

Trung tâm tích hợp nhà cung cấp (Provider Integration Hub) được xây dựng trên nền tảng **NestJS 11**, **Drizzle ORM** và **PostgreSQL**, áp dụng chặt chẽ kiến trúc **Domain-Driven Design (DDD) + Hexagonal (Ports & Adapters)**.

---

## 🏗️ Kiến Trúc Hệ Thống (Hexagonal Architecture)

Dự án phân chia các module thành 4 layer riêng biệt:

```
                    ┌──────────────── LÕI ────────────────┐
  HTTP ─► Controller ─►  Service ──► Entity / VO / Policy │
  (adapter vào)     │      │                              │
                    │      ├──► RepositoryPort ◄──────────┼── ProviderRepository (Drizzle)   ─► Postgres
                    │      └──► ConnectionPort ◄──────────┼── HttpProviderConnectionAdapter  ─► API ngoài
                    └─────────────────────────────────────┘      (adapter ra)
```

1. **Domain (`domain/`)**: Lõi nghiệp vụ thuần túy (Entities, Value Objects, Domain Errors, Ports). Hoàn toàn độc lập với framework, database và HTTP.
2. **Application (`application/`)**: Điều phối các use case, transaction, audit logging.
3. **Infrastructure (`infrastructure/`)**: Triển khai các Ports (Drizzle schemas, repositories, external API clients, logger adapter).
4. **Presentation (`presentation/`)**: Nhận HTTP request, validate qua DTOs, trả dữ liệu an toàn qua Response DTOs.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

- **Framework**: [NestJS 11](https://nestjs.com/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Database**: [PostgreSQL 16](https://www.postgresql.org/) (Primary key sử dụng `uuidv7` tối ưu B-Tree indexing)
- **API Docs**: Swagger / OpenAPI UI
- **Logging**: Custom Tagged Logger với `AsyncLocalStorage` tự động trace `requestId` (`[req:xxx] [LAYER][Context][Component]`)
- **Testing**: Jest (Unit Tests & Supertest E2E Tests)

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Dự Án

### 1. Yêu cầu tiên quyết
- Node.js >= 20.x
- Docker & Docker Compose (cho PostgreSQL local)

### 2. Thiết lập môi trường
Sao chép file cấu hình môi trường mẫu:
```bash
cp .env.example .env
```

> Sửa mật khẩu trong `DATABASE_URL` thành `password` (khớp `docker-compose.yml`) và thêm `JWT_SECRET`, `REFRESH_JWT_SECRET`. Xem [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

### 3. Khởi động Cơ sở dữ liệu (Docker)
```bash
docker compose up -d
```

### 4. Cài đặt dependencies & Chạy Migration
```bash
npm install
npm run db:migrate
```

Các lệnh quản lý database khác:
- `npm run db:generate`: Sinh migration file mới từ schema Drizzle
- `npm run db:push`: Đẩy trực tiếp schema lên DB (dùng trong dev nhanh)
- `npm run db:studio`: Mở giao diện Drizzle Studio trực quan

### 5. Chạy ứng dụng
```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

### 6. Xem tài liệu API (Swagger UI)
Sau khi ứng dụng khởi chạy thành công, truy cập Swagger UI tại:
👉 `http://localhost:3000/docs`

---

## 🧪 Kiểm Thử & Kiểm Tra Mã Nguồn (CI / Quality)

```bash
# Chạy Unit Tests
npm run test

# Chạy E2E Tests
npm run test:e2e

# Kiểm tra & tự động sửa lỗi cú pháp / linter
npm run lint

# Format code với Prettier
npm run format
```

---

## 📚 Tài Liệu Hướng Dẫn Nội Bộ

Tài liệu hệ thống trong thư mục `docs/`:
- [Tổng Quan Dự Án](docs/PROJECT.md): Mục tiêu, trạng thái hiện tại, vấn đề đã biết, hướng phát triển.
- [Kiến Trúc](docs/ARCHITECTURE.md): Module, vòng đời request, port/adapter, cơ chế dùng chung.
- [Đặc Tả API](docs/API.md): Xác thực, định dạng lỗi, rate limit, chi tiết từng endpoint.
- [Cơ Sở Dữ Liệu](docs/DATABASE.md): Schema, quan hệ, index, lịch sử migration.
- [Bảo Mật](docs/SECURITY.md): Luồng JWT + session, mật khẩu, phân quyền, rủi ro đã biết.
- [Cấu Hình](docs/CONFIGURATION.md): Biến môi trường và cấu hình viết cứng.
- [Phát Triển](docs/DEVELOPMENT.md): Cài đặt local, lệnh, quy ước code, kiểm thử.
- [Triển Khai](docs/DEPLOYMENT.md): Docker, migration production, CI, vận hành.

Hướng dẫn chuyên đề:
- [Cấu Trúc Module Hexagonal](docs/huong-dan/cau-truc-module-hexagonal.md): Quy chuẩn từng file trong một module DDD.
- [Hướng Dẫn Tạo Module Mới](docs/huong-dan/huong-dan-tao-module.md): Các bước tạo nhanh module mới theo template.
- [Hướng Dẫn Tiêu Chuẩn Logging](docs/huong-dan/huong-dan-logging.md): Quy ước format tag, levels, và redaction.
- [Hướng Dẫn Quy Trình Migration](docs/huong-dan/huong-dan-migration.md): Quy trình quản lý thay đổi schema DB với Drizzle.
