import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PoliciesGuard } from './policies.guard';
import { CaslAbilityFactory } from '../../application/casl-ability.factory';
import { TokenPayload } from '@modules/authentication/domain/auth-token.vo';
import { Action } from '../../domain/action.enum';
import { UserEntity } from '@modules/user/domain/user.entity';

describe('PoliciesGuard', () => {
  let reflector: Record<string, jest.Mock>;
  let caslAbilityFactory: CaslAbilityFactory;
  let guard: PoliciesGuard;

  const createContext = (user?: Partial<TokenPayload>): ExecutionContext =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    caslAbilityFactory = new CaslAbilityFactory();
    guard = new PoliciesGuard(
      reflector as unknown as Reflector,
      caslAbilityFactory,
    );
  });

  it('nên cho qua khi route không yêu cầu policy', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(await guard.canActivate(createContext())).toBe(true);
  });

  it('nên cho qua khi user thỏa mãn policy', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      (ability: any) => ability.can(Action.Manage, 'all'),
    ]);

    expect(
      await guard.canActivate(
        createContext({
          sub: '1',
          email: 'admin@example.com',
          role: 'ADMIN',
        }),
      ),
    ).toBe(true);
  });

  it('nên ném ForbiddenException khi user không thỏa mãn policy', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      (ability: any) => ability.can(Action.Delete, UserEntity),
    ]);

    await expect(
      guard.canActivate(
        createContext({
          sub: '2',
          email: 'user@example.com',
          role: 'USER',
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('nên ném ForbiddenException khi request không có user', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      (ability: any) => ability.can(Action.Read, UserEntity),
    ]);

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      ForbiddenException,
    );
  });
});
