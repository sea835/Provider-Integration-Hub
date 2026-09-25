import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleEntity } from '../../domain/role.entity';

export class RoleResponseDto {
  @ApiProperty({ example: '0192f3a1-8e9a-7c3d-b4ef-123456789abc' })
  id: string;

  @ApiProperty({ example: 'SUPPORT' })
  code: string;

  @ApiProperty({ example: 'Chuyên viên Hỗ trợ' })
  name: string;

  @ApiPropertyOptional({ example: 'Hỗ trợ khách hàng' })
  description?: string | null;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;

  @ApiProperty({ example: '2026-09-25T08:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-09-25T08:00:00.000Z' })
  updatedAt: Date;

  static fromEntity(entity: RoleEntity): RoleResponseDto {
    const dto = new RoleResponseDto();
    dto.id = entity.id;
    dto.code = entity.code;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.status = entity.status;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
