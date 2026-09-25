import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserEntity } from '@modules/user/domain/user.entity';

export class UserResponseDto {
  @ApiProperty({
    example: '0192f3a1-8e9a-7c3d-b4ef-123456789abc',
    description: 'UUIDv7 của người dùng',
  })
  id: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'Địa chỉ email người dùng',
  })
  email: string;

  @ApiProperty({
    example: 'USER',
    description: 'Vai trò người dùng trong hệ thống (ADMIN, USER, MANAGER)',
  })
  role: string;

  @ApiProperty({
    example: 'ACTIVE',
    description: 'Trạng thái người dùng',
  })
  status: string;

  @ApiProperty({
    example: '2026-09-24T08:00:00.000Z',
    description: 'Thời điểm tạo bản ghi',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-09-24T08:00:00.000Z',
    description: 'Thời điểm cập nhật gần nhất',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    example: null,
    description: 'ID người tạo bản ghi',
  })
  createdBy?: string | null;

  @ApiPropertyOptional({
    example: null,
    description: 'ID người cập nhật bản ghi',
  })
  updatedBy?: string | null;

  @ApiPropertyOptional({
    example: {},
    description: 'Thông tin mở rộng (JSONB)',
  })
  metadata?: Record<string, unknown> | null;

  static fromEntity(user: UserEntity): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.role = user.role || 'USER';
    dto.status = user.status;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    dto.createdBy = user.createdBy;
    dto.updatedBy = user.updatedBy;
    dto.metadata = user.metadata;
    return dto;
  }
}
