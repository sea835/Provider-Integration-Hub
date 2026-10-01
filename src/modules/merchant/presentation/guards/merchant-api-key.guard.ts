import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { MerchantAuthService } from '@modules/merchant/application/merchant-auth.service';
import { AuthenticatedMerchant } from '@modules/merchant/domain/merchant.entity';

export const MERCHANT_API_KEY_HEADER = 'x-api-key';

export type MerchantRequest = Request & { merchant?: AuthenticatedMerchant };

@Injectable()
export class MerchantApiKeyGuard implements CanActivate {
  constructor(private readonly auth: MerchantAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MerchantRequest>();
    const header = request.headers[MERCHANT_API_KEY_HEADER];
    const apiKey = Array.isArray(header) ? header[0] : header;
    request.merchant = await this.auth.authenticate(apiKey, request.ip);
    return true;
  }
}
