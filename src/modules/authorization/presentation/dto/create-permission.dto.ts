import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsObject } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({
    description: 'Hành động được phép thực hiện',
    example: 'create',
  })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiProperty({
    description: 'Đối tượng bị tác động (Entity hoặc "all")',
    example: 'User',
  })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiPropertyOptional({
    description: 'Điều kiện phân quyền ABAC theo thuộc tính (dạng JSON)',
    example: { id: '${user.sub}' },
  })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Mô tả quyền hạn',
    example: 'Cho phép tạo người dùng mới',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
