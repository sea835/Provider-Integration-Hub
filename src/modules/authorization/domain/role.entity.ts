import { BaseEntity } from '@common/base/base.entity';

export class RoleEntity extends BaseEntity {
  code: string;
  name: string;
  description?: string | null;
}
