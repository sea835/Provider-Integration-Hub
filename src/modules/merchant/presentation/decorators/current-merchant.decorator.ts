import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { MerchantRequest } from '@modules/merchant/presentation/guards/merchant-api-key.guard';
import type { AuthenticatedMerchant } from '@modules/merchant/domain/merchant.entity';

export const CurrentMerchant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedMerchant => {
    const request = ctx.switchToHttp().getRequest<MerchantRequest>();
    return request.merchant!;
  },
);
