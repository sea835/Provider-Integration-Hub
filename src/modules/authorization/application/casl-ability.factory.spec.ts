import { CaslAbilityFactory } from './casl-ability.factory';
import { Action } from '../domain/action.enum';
import { Role } from '@modules/user/domain/user-role';
import { UserEntity } from '@modules/user/domain/user.entity';
import { TokenPayload } from '@modules/authentication/domain/auth-token.vo';
import { RoleRepositoryPort } from '../domain/role.repository.port';

describe('CaslAbilityFactory', () => {
  let factory: CaslAbilityFactory;
  let mockRoleRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    mockRoleRepo = {
      getPermissionsByRoleCode: jest.fn().mockResolvedValue([]),
    };
    factory = new CaslAbilityFactory(
      mockRoleRepo as unknown as RoleRepositoryPort,
    );
  });

  it('nên cho phép ADMIN quản lý tất cả', async () => {
    const adminUser: TokenPayload = {
      sub: 'admin-id',
      email: 'admin@example.com',
      role: Role.ADMIN,
    };
    const ability = await factory.createForUser(adminUser);

    expect(ability.can(Action.Manage, 'all')).toBe(true);
    expect(ability.can(Action.Delete, UserEntity)).toBe(true);
  });

  it('nên cho phép USER đọc nhưng không được xóa UserEntity theo fallback rule', async () => {
    const normalUser: TokenPayload = {
      sub: 'user-id',
      email: 'user@example.com',
      role: Role.USER,
    };
    const ability = await factory.createForUser(normalUser);

    expect(ability.can(Action.Read, UserEntity)).toBe(true);
    expect(ability.can(Action.Delete, UserEntity)).toBe(false);
  });

  it('nên nạp quyền động từ database nếu role có permissions được gán', async () => {
    mockRoleRepo.getPermissionsByRoleCode.mockResolvedValue([
      {
        action: 'create',
        subject: 'User',
      },
    ]);

    const operatorUser: TokenPayload = {
      sub: 'op-1',
      email: 'op@example.com',
      role: 'OPERATOR',
    };
    const ability = await factory.createForUser(operatorUser);

    expect(ability.can(Action.Create, UserEntity)).toBe(true);
    expect(ability.can(Action.Delete, UserEntity)).toBe(false);
  });

  it('nên không có quyền khi không có role', async () => {
    const ability = await factory.createForUser(undefined);

    expect(ability.can(Action.Read, UserEntity)).toBe(false);
    expect(ability.can(Action.Manage, 'all')).toBe(false);
  });
});
