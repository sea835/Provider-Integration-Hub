import { UserEntity } from '@modules/user/domain/user.entity';

export class UserResponseDto {
  id: string;
  email: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
  metadata?: Record<string, unknown> | null;

  static fromEntity(user: UserEntity): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.status = user.status;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    dto.createdBy = user.createdBy;
    dto.updatedBy = user.updatedBy;
    dto.metadata = user.metadata;
    return dto;
  }
}
