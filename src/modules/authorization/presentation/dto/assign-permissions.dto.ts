import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class AssignPermissionsDto {
  @ApiProperty({
    description: 'Danh sách ID của các quyền hạn cần gán vào vai trò',
    example: [
      '0192f3a1-8e9a-7c3d-b4ef-123456789abc',
      '0192f3a1-8e9a-7c3d-b4ef-987654321def',
    ],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  permissionIds: string[];
}
