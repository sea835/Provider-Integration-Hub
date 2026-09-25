import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateRoleDto {
  @ApiPropertyOptional({
    description: 'Tên hiển thị của vai trò',
    example: 'Chuyên viên Chăm sóc Khách hàng',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Mô tả vai trò',
    example: 'Cập nhật quyền và mô tả nhiệm vụ',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái vai trò',
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsString()
  status?: string;
}
