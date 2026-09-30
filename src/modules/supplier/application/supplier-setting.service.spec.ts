import { SupplierSettingService } from './supplier-setting.service';
import { SupplierSettingRepositoryPort } from '../domain/supplier-setting.repository.port';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('SupplierSettingService', () => {
  let service: SupplierSettingService;
  let mockRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    mockRepo = {
      findBySupplierId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn(),
      findPaginated: jest.fn(),
      delete: jest.fn(),
    };

    service = new SupplierSettingService(
      mockRepo as unknown as SupplierSettingRepositoryPort,
    );
  });

  describe('createSetting', () => {
    it('should throw ConflictException if setting already exists for supplierId', async () => {
      mockRepo.findBySupplierId.mockResolvedValue({ id: 'set-1' });

      await expect(
        service.createSetting({
          supplierId: '00000000-0000-0000-0000-000000000001',
          baseUrl: 'https://api.ncc.vn',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create setting when supplierId is not duplicated', async () => {
      mockRepo.findBySupplierId.mockResolvedValue(null);
      mockRepo.create.mockImplementation((data) =>
        Promise.resolve({ id: 'set-1', ...data }),
      );

      const result = await service.createSetting({
        supplierId: '00000000-0000-0000-0000-000000000001',
        baseUrl: 'https://api.ncc.vn',
        rateLimitRpm: 120,
      });

      expect(result.supplierId).toBe('00000000-0000-0000-0000-000000000001');
      expect(result.rateLimitRpm).toBe(120);
      expect(mockRepo.create).toHaveBeenCalled();
    });
  });

  describe('getBySupplierId', () => {
    it('should return setting if found', async () => {
      mockRepo.findBySupplierId.mockResolvedValue({
        id: 'set-1',
        supplierId: 'sup-1',
        baseUrl: 'https://api.ncc.vn',
      });

      const result = await service.getBySupplierId('sup-1');
      expect(result.id).toBe('set-1');
    });

    it('should throw NotFoundException if setting not found', async () => {
      mockRepo.findBySupplierId.mockResolvedValue(null);

      await expect(service.getBySupplierId('sup-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
