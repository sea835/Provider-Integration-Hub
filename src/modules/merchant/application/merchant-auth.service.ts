import { Inject, Injectable } from '@nestjs/common';
import { normalizeIp } from '@common/libs/normalize-ip';
import { MerchantRepositoryPort } from '@modules/merchant/domain/merchant.repository.port';
import { AuthenticatedMerchant } from '@modules/merchant/domain/merchant.entity';
import { MerchantStatus } from '@modules/merchant/domain/merchant-status';
import {
  InvalidApiKeyError,
  IpNotAllowedError,
} from '@modules/merchant/domain/merchant.errors';
import { hashApiKey } from '@modules/merchant/application/api-key';

@Injectable()
export class MerchantAuthService {
  constructor(
    @Inject(MerchantRepositoryPort)
    private readonly merchants: MerchantRepositoryPort,
  ) {}

  async authenticate(
    apiKey: string | undefined,
    ip: string | undefined,
  ): Promise<AuthenticatedMerchant> {
    if (!apiKey) throw new InvalidApiKeyError();

    const merchant = await this.merchants.findByApiKeyHash(hashApiKey(apiKey));
    if (!merchant || merchant.status !== MerchantStatus.ACTIVE) {
      throw new InvalidApiKeyError();
    }

    const clientIp = normalizeIp(ip);
    if (
      merchant.ipWhitelist.length > 0 &&
      !merchant.ipWhitelist.includes(clientIp)
    ) {
      throw new IpNotAllowedError(clientIp);
    }

    return { id: merchant.id, code: merchant.code };
  }
}
