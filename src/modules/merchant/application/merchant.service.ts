import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { LoggerPort, LogLayer } from '@common/logger';
import { omitUndefined } from '@common/libs/omit-undefined';
import { SecretCipherPort } from '@common/crypto/secret-cipher.port';
import {
  PaginatedResult,
  PaginationQueryDto,
} from '@common/base/pagination.dto';
import { MerchantRepositoryPort } from '@modules/merchant/domain/merchant.repository.port';
import {
  MerchantCallbackConfig,
  MerchantEntity,
} from '@modules/merchant/domain/merchant.entity';
import {
  MerchantStatus,
  MerchantStatusType,
} from '@modules/merchant/domain/merchant-status';
import {
  MerchantCallbackNotReadyError,
  MerchantNotFoundError,
} from '@modules/merchant/domain/merchant.errors';
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
  callbackUrl?: string | null;
  callbackEnabled?: boolean;
}

export interface MerchantWithKey {
  merchant: MerchantEntity;
  apiKey: string;
}

export interface MerchantWithCallbackSecret {
  merchant: MerchantEntity;
  secret: string;
}

const CALLBACK_SECRET_PREFIX = 'whsec_';

@Injectable()
export class MerchantService {
  private readonly logger: LoggerPort;

  constructor(
    @Inject(MerchantRepositoryPort)
    private readonly merchants: MerchantRepositoryPort,
    private readonly cipher: SecretCipherPort,
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
    const current = await this.get(id);
    const patch = omitUndefined({
      ...input,
      callbackUrl:
        input.callbackUrl === undefined
          ? undefined
          : input.callbackUrl?.trim() || null,
    });
    const next = { ...current, ...patch };
    if (next.callbackEnabled && !next.callbackUrl) {
      throw new MerchantCallbackNotReadyError(
        'Nhập địa chỉ nhận callback trước khi bật',
      );
    }
    if (next.callbackEnabled && !next.callbackSecretEnc) {
      throw new MerchantCallbackNotReadyError(
        'Tạo khoá ký callback trước khi bật',
      );
    }
    const updated = await this.merchants.update(id, {
      ...patch,
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

  /** Tạo khoá ký callback mới (khoá cũ hết hiệu lực ngay). Khoá gốc chỉ trả về một lần. */
  async rotateCallbackSecret(
    id: string,
    actorId?: string,
  ): Promise<MerchantWithCallbackSecret> {
    await this.get(id);
    const secret = `${CALLBACK_SECRET_PREFIX}${randomBytes(24).toString('base64url')}`;
    const merchant = await this.merchants.update(id, {
      callbackSecretEnc: this.cipher.encrypt({ secret }),
      callbackSecretLast4: secret.slice(-4),
      updatedBy: actorId ?? null,
    });
    if (!merchant) throw new MerchantNotFoundError(id);

    this.logger.info('Đổi khoá ký callback merchant', { code: merchant.code });
    return { merchant, secret };
  }

  /** Cấu hình callback đã giải mã khoá ký; chỉ dùng để gửi callback. */
  async callbackConfig(id: string): Promise<MerchantCallbackConfig> {
    const merchant = await this.get(id);
    let secret: string | null = null;
    if (merchant.callbackSecretEnc) {
      const value = this.cipher.decrypt(merchant.callbackSecretEnc).secret;
      secret = typeof value === 'string' ? value : null;
    }
    return {
      enabled: merchant.callbackEnabled,
      url: merchant.callbackUrl,
      secret,
    };
  }
}
