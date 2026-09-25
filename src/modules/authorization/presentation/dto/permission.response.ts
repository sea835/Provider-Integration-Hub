import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PermissionEntity } from '../../domain/permission.entity';

export class PermissionResponseDto {
  @ApiProperty({ example: '0192f3a1-8e9a-7c3d-b4ef-123456789abc' })
  id: string;

  @ApiProperty({ example: 'create' })
  action: string;

  @ApiProperty({ example: 'User' })
  subject: string;

  @ApiPropertyOptional({ example: { id: '${user.sub}' } })
  conditions?: Record<string, unknown> | null;

  @ApiPropertyOptional({ example: 'Cho phép tạo người dùng' })
  description?: string | null;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;

  @ApiProperty({ example: '2026-09-25T08:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-09-25T08:00:00.000Z' })
  updatedAt: Date;

  static fromEntity(entity: PermissionEntity): PermissionResponseDto {
    const dto = new PermissionResponseDto();
    dto.id = entity.id;
    dto.action = entity.action;
    dto.subject = entity.subject;
    dto.conditions = entity.conditions;
    dto.description = entity.description;
    dto.status = entity.status;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
