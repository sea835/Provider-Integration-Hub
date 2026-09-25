import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PermissionRepositoryPort } from '../domain/permission.repository.port';
import { PermissionEntity } from '../domain/permission.entity';

@Injectable()
export class PermissionService {
  constructor(
    private readonly permissionRepository: PermissionRepositoryPort,
  ) {}

  async createPermission(data: {
    action: string;
    subject: string;
    conditions?: Record<string, unknown>;
    description?: string;
  }): Promise<PermissionEntity> {
    const existing = await this.permissionRepository.findByActionAndSubject(
      data.action,
      data.subject,
    );
    if (existing) {
      throw new ConflictException(
        `Permission với action ${data.action} và subject ${data.subject} đã tồn tại`,
      );
    }

    return this.permissionRepository.create({
      action: data.action,
      subject: data.subject,
      conditions: data.conditions || null,
      description: data.description,
      status: 'ACTIVE',
    });
  }

  async findAllPermissions(): Promise<PermissionEntity[]> {
    return this.permissionRepository.findAll();
  }

  async findPermissionById(id: string): Promise<PermissionEntity> {
    const permission = await this.permissionRepository.findById(id);
    if (!permission) {
      throw new NotFoundException(`Không tìm thấy Permission với ID ${id}`);
    }
    return permission;
  }

  async deletePermission(id: string): Promise<boolean> {
    await this.findPermissionById(id);
    return this.permissionRepository.delete(id);
  }
}
