import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '@modules/authentication/presentation/decorators/public.decorator';
import { MerchantApiKeyGuard } from '@modules/merchant/presentation/guards/merchant-api-key.guard';

export const MERCHANT_API_KEY_SECURITY = 'merchant-api-key';

/**
 * Endpoint dành cho merchant (Store): xác thực bằng X-Api-Key thay vì JWT.
 * Bỏ throttle theo IP vì mọi request của một Store đến từ cùng IP.
 */
export const MerchantAuth = () =>
  applyDecorators(
    Public(),
    SkipThrottle(),
    UseGuards(MerchantApiKeyGuard),
    ApiSecurity(MERCHANT_API_KEY_SECURITY),
  );
