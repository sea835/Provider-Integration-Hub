import { BaseRepositoryPort } from '@common/base/base.repository.port';
import { PermissionEntity } from './permission.entity';

export abstract class PermissionRepositoryPort extends BaseRepositoryPort<PermissionEntity> {
  abstract findByActionAndSubject(
    action: string,
    subject: string,
  ): Promise<PermissionEntity | null>;
}
