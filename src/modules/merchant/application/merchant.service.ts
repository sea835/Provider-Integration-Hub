import { Inject, Injectable } from '@nestjs/common';
import { LoggerPort, LogLayer } from '@common/logger';
import { omitUndefined } from '@common/libs/omit-undefined';
import {
  PaginatedResult,
  PaginationQueryDto,
} from '@common/base/pagination.dto';
import { MerchantRepositoryPort } from '@modules/merchant/domain/merchant.repository.port';
import { MerchantEntity } from '@modules/merchant/domain/merchant.entity';
import {
  MerchantStatus,
  MerchantStatusType,
} from '@modules/merchant/domain/merchant-status';
import { MerchantNotFoundError } from '@modules/merchant/domain/merchant.errors';
import { generateApiKey } from '@modules/merchant/application/api-key';

export interface CreateMerchantInput {
  code: string;
  name: string;
  ipWhitelist?: string[];
}

export interface UpdateMerchantInput {
  name?: string;
  status?: MerchantStatusType;
  ipWhitelist?: string[];
}

export interface MerchantWithKey {
  merchant: MerchantEntity;
  apiKey: string;
}

@Injectable()
export class MerchantService {
  private readonly logger: LoggerPort;

  constructor(
    @Inject(MerchantRepositoryPort)
    private readonly merchants: MerchantRepositoryPort,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.APPLICATION,
      'Merchant',
      MerchantService.name,
    );
  }

  list(query: PaginationQueryDto): Promise<PaginatedResult<MerchantEntity>> {
    return this.merchants.findPaginated!(query);
  }

  async get(id: string): Promise<MerchantEntity> {
    const merchant = await this.merchants.findById(id);
    if (!merchant) throw new MerchantNotFoundError(id);
    return merchant;
  }

  /** Tạo merchant (Store). API key chỉ trả về một lần. */
  async create(
    input: CreateMerchantInput,
    actorId?: string,
  ): Promise<MerchantWithKey> {
    const apiKey = generateApiKey();
    const merchant = await this.merchants.create({
      code: input.code.trim().toUpperCase(),
      name: input.name,
      ipWhitelist: input.ipWhitelist ?? [],
      apiKeyHash: apiKey.hash,
      apiKeyLast4: apiKey.last4,
      status: MerchantStatus.ACTIVE,
      createdBy: actorId ?? null,
      updatedBy: actorId ?? null,
    });

    this.logger.info('Tạo merchant', { code: merchant.code });
    return { merchant, apiKey: apiKey.key };
  }

  async update(
    id: string,
    input: UpdateMerchantInput,
    actorId?: string,
  ): Promise<MerchantEntity> {
    const updated = await this.merchants.update(id, {
      ...omitUndefined(input),
      updatedBy: actorId ?? null,
    });
    if (!updated) throw new MerchantNotFoundError(id);
    return updated;
  }

  /** Cấp key mới, key cũ hết hiệu lực ngay. */
  async rotateKey(id: string, actorId?: string): Promise<MerchantWithKey> {
    const apiKey = generateApiKey();
    const merchant = await this.merchants.update(id, {
      apiKeyHash: apiKey.hash,
      apiKeyLast4: apiKey.last4,
      updatedBy: actorId ?? null,
    });
    if (!merchant) throw new MerchantNotFoundError(id);

    this.logger.info('Đổi API key merchant', { code: merchant.code });
    return { merchant, apiKey: apiKey.key };
  }
}
