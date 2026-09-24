import { BaseEntity } from '@common/base/base.entity';

export class UserEntity extends BaseEntity {
    email: string;
    password: string;
}
