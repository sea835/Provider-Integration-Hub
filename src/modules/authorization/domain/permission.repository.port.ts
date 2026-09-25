import { PermissionEntity } from './permission.entity';

export abstract class PermissionRepositoryPort {
  abstract create(data: Partial<PermissionEntity>): Promise<PermissionEntity>;
  abstract findById(id: string): Promise<PermissionEntity | null>;
  abstract findAll(): Promise<PermissionEntity[]>;
  abstract findByActionAndSubject(
    action: string,
    subject: string,
  ): Promise<PermissionEntity | null>;
  abstract delete(id: string): Promise<boolean>;
}
