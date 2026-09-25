import { BaseEntity } from '@common/base/base.entity';

export class PermissionEntity extends BaseEntity {
  action: string;
  subject: string;
  conditions?: Record<string, unknown> | null;
  description?: string | null;
}
