import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { TokenPayload } from '@modules/auth/domain/auth-token.vo';

export const CurrentUser = createParamDecorator(
  (data: keyof TokenPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = (request as unknown as { user?: TokenPayload }).user;
    return data ? user?.[data] : user;
  },
);
