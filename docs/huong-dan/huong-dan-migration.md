# Hướng Dẫn Migration Database (Drizzle ORM)

Tài liệu hướng dẫn quy trình tạo và thực thi migration cho cơ sở dữ liệu sử dụng **Drizzle ORM** trong dự án **Provider Integration Hub**.

---

## 1. Quy Trình Làm Việc Chuẩn (Dành Cho Mọi Môi Trường)

Đây là quy trình an toàn, sinh ra lịch sử các file `.sql` để theo dõi và quản lý mọi sự thay đổi của Database theo thời gian.

### Bước 1: Cập nhật Schema
Thêm mới hoặc chỉnh sửa các file schema theo đúng cấu trúc của module (được cấu hình theo pattern `./src/modules/**/infrastructure/*.schema.ts`).
> **Ví dụ:** Chỉnh sửa file `../../src/modules/user/infrastructure/user.schema.ts`.

### Bước 2: Phát sinh file Migration
Chạy lệnh `generate` để so sánh các file schema hiện tại với snapshot database và tạo ra file `.sql` mới lưu tại thư mục `./drizzle/migrations`:

```bash
npm run db:generate
```

*Sau khi chạy, kiểm tra lại nội dung file `.sql` vừa được sinh ra trong `./drizzle/migrations` để đảm bảo các câu lệnh DDL (CREATE, ALTER, DROP,...) đúng như mong đợi.*

### Bước 3: Thực thi Migration
Chạy lệnh `migrate` để áp dụng các thay đổi từ file `.sql` vào Database:

```bash
npm run db:migrate
```

---

## 2. Các Lưu Ý Quan Trọng (Best Practices & Quy Tắc An Toàn)

### 1. Đồng bộ (Sync) giữa các bên để tránh Conflict Migration
- Khi có nhiều thành viên cùng làm việc liên quan đến thay đổi cơ sở dữ liệu, **bắt buộc phải thông báo và đồng bộ code** trước khi tiến hành migrate.
- **Kịch bản thực tế:**
  - Thành viên **A** và thành viên **B** cùng tạo migration.
  - Nếu **A** hoàn thành và merge/đẩy migration lên trước, **A phải báo cho B**.
  - **B bắt buộc phải kéo (pull) code mới nhất về**, chạy `npm run db:migrate` để cập nhật các thay đổi của A vào DB local, sau đó mới tạo (generate) migration tiếp theo của mình. Điều này giúp tránh xung đột snapshot và sai lệch thứ tự migration log.

### 2. Không xóa các file Migration cũ & Luôn test kỹ trước khi chạy
- **Tuyệt đối không xóa** bất kỳ file migration cũ nào trong thư mục `./drizzle/migrations` sau khi đã được commit và thực thi. Drizzle theo dõi lịch sử thông qua bảng journal (`__drizzle_migrations`); việc xóa file sẽ làm hỏng tính toàn vẹn của lịch sử migration.
- Luôn kiểm tra kỹ câu lệnh SQL do Drizzle sinh ra trước khi chạy lệnh migrate, đặc biệt là các lệnh có nguy cơ mất mát dữ liệu như `DROP COLUMN`, `DROP TABLE`, hoặc đổi kiểu dữ liệu (type casting).

### 3. Drizzle không có cơ chế Rollback (Undo Migration)
- Drizzle ORM **không hỗ trợ cơ chế rollback/down migration tự động**.
- **Cách khắc phục khi migration bị sai:**
  - Tuyệt đối **không sửa hay xóa trực tiếp** file migration đã thực thi trên Database chung.
  - Sửa lại file Schema về trạng thái mong muốn (hoặc viết xử lý bù trừ).
  - Chạy `npm run db:generate` để tạo ra một file migration mới thực hiện việc điều chỉnh lại, sau đó chạy `npm run db:migrate`.
- **Khuyến nghị môi trường Test Database:**
  - Luôn kiểm thử migration trên một **Database Test / Staging** trước.
  - Khi xác nhận migration chạy trơn tru và không làm gián đoạn hệ thống, mới tiến hành migrate trên Database chính (Production).

---

## 3. Lệnh Hỗ Trợ Khác

- **Drizzle Studio (Trực quan hóa Database trên UI):**
  ```bash
  npm run db:studio
  ```
  *(Dùng để xem trực tiếp các bảng, dữ liệu trên trình duyệt phục vụ debug nhanh)*
