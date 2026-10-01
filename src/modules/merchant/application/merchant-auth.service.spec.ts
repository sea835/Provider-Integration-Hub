import { MerchantAuthService } from '@modules/merchant/application/merchant-auth.service';
import {
  generateApiKey,
  hashApiKey,
} from '@modules/merchant/application/api-key';
import { MerchantRepositoryPort } from '@modules/merchant/domain/merchant.repository.port';
import { MerchantEntity } from '@modules/merchant/domain/merchant.entity';
import {
  InvalidApiKeyError,
  IpNotAllowedError,
} from '@modules/merchant/domain/merchant.errors';

describe('MerchantAuthService', () => {
  const key = generateApiKey();
  let merchant: Partial<MerchantEntity> | null;
  let service: MerchantAuthService;

  beforeEach(() => {
    merchant = {
      id: 'm1',
      code: 'MSTORE',
      status: 'ACTIVE',
      apiKeyHash: key.hash,
      ipWhitelist: [],
    };
    const repo = {
      findByApiKeyHash: jest.fn((hash: string) =>
        Promise.resolve(
          merchant && hash === merchant.apiKeyHash ? merchant : null,
        ),
      ),
    };
    service = new MerchantAuthService(
      repo as unknown as MerchantRepositoryPort,
    );
  });

  it('key hợp lệ trả về merchant', async () => {
    await expect(service.authenticate(key.key, '1.2.3.4')).resolves.toEqual({
      id: 'm1',
      code: 'MSTORE',
    });
  });

  it('DB chỉ lưu sha256, không lưu key gốc', () => {
    expect(key.hash).toBe(hashApiKey(key.key));
    expect(key.hash).not.toContain(key.key);
    expect(key.last4).toBe(key.key.slice(-4));
  });

  it.each([undefined, '', 'pk_wrong'])(
    'key "%s" bị từ chối',
    async (apiKey) => {
      await expect(
        service.authenticate(apiKey, '1.2.3.4'),
      ).rejects.toBeInstanceOf(InvalidApiKeyError);
    },
  );

  it('merchant không ACTIVE bị từ chối', async () => {
    merchant!.status = 'INACTIVE';
    await expect(
      service.authenticate(key.key, '1.2.3.4'),
    ).rejects.toBeInstanceOf(InvalidApiKeyError);
  });

  it('IP whitelist: đúng IP (kể cả dạng ::ffff:) thì qua, sai IP thì 403', async () => {
    merchant!.ipWhitelist = ['1.2.3.4'];
    await expect(
      service.authenticate(key.key, '::ffff:1.2.3.4'),
    ).resolves.toBeDefined();
    await expect(
      service.authenticate(key.key, '5.6.7.8'),
    ).rejects.toBeInstanceOf(IpNotAllowedError);
  });
});
