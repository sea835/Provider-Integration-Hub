import { BaseEntity } from '@common/base/base.entity';

export class SupplierAccountEntity extends BaseEntity {
  supplierId: string;
  username: string;
  passwordHash: string;
  supplierToken?: string | null;
  email?: string | null;
  role: string;
  declare status: any; // int in ERD (1: ACTIVE, 0: INACTIVE)
  declare metadata?: any;
}
