import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '@modules/auth/presentation/guards/roles.guard';
import { TokenPayload } from '@modules/auth/domain/auth-token.vo';

describe('RolesGuard', () => {
  let reflector: Record<string, jest.Mock>;
  let guard: RolesGuard;

  const createContext = (user?: Partial<TokenPayload>): ExecutionContext =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('nên cho qua khi route không yêu cầu role', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('nên cho qua khi user có role nằm trong danh sách yêu cầu', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN', 'MANAGER']);

    expect(guard.canActivate(createContext({ role: 'MANAGER' }))).toBe(true);
  });

  it('nên ném ForbiddenException khi user không đủ role', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(() => guard.canActivate(createContext({ role: 'USER' }))).toThrow(
      ForbiddenException,
    );
  });

  it('nên ném ForbiddenException khi request không có user (không lỗi 500)', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(() => guard.canActivate(createContext())).toThrow(
      ForbiddenException,
    );
  });
});
