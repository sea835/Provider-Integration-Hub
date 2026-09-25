import { CaslAbilityFactory } from './casl-ability.factory';
import { Action } from '../domain/action.enum';
import { Role } from '@modules/user/domain/user-role';
import { UserEntity } from '@modules/user/domain/user.entity';
import { TokenPayload } from '@modules/authentication/domain/auth-token.vo';

describe('CaslAbilityFactory', () => {
  let factory: CaslAbilityFactory;

  beforeEach(() => {
    factory = new CaslAbilityFactory();
  });

  it('nên cho phép ADMIN quản lý tất cả', () => {
    const adminUser: TokenPayload = {
      sub: 'admin-id',
      email: 'admin@example.com',
      role: Role.ADMIN,
    };
    const ability = factory.createForUser(adminUser);

    expect(ability.can(Action.Manage, 'all')).toBe(true);
    expect(ability.can(Action.Delete, UserEntity)).toBe(true);
  });

  it('nên cho phép USER đọc nhưng không được xóa UserEntity', () => {
    const normalUser: TokenPayload = {
      sub: 'user-id',
      email: 'user@example.com',
      role: Role.USER,
    };
    const ability = factory.createForUser(normalUser);

    expect(ability.can(Action.Read, UserEntity)).toBe(true);
    expect(ability.can(Action.Delete, UserEntity)).toBe(false);
  });

  it('nên cho phép MANAGER đọc và cập nhật nhưng không được xóa UserEntity', () => {
    const managerUser: TokenPayload = {
      sub: 'manager-id',
      email: 'manager@example.com',
      role: Role.MANAGER,
    };
    const ability = factory.createForUser(managerUser);

    expect(ability.can(Action.Read, UserEntity)).toBe(true);
    expect(ability.can(Action.Update, UserEntity)).toBe(true);
    expect(ability.can(Action.Delete, UserEntity)).toBe(false);
  });

  it('nên không có quyền khi không có role', () => {
    const ability = factory.createForUser(undefined);

    expect(ability.can(Action.Read, UserEntity)).toBe(false);
    expect(ability.can(Action.Manage, 'all')).toBe(false);
  });
});
