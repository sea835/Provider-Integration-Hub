import { SupplierAccountService } from './supplier-account.service';
import { SupplierAccountRepositoryPort } from '../domain/supplier-account.repository.port';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('SupplierAccountService', () => {
  let service: SupplierAccountService;
  let mockRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    mockRepo = {
      findByUsername: jest.fn(),
      findBySupplierId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn(),
      findPaginated: jest.fn(),
      delete: jest.fn(),
    };

    service = new SupplierAccountService(
      mockRepo as unknown as SupplierAccountRepositoryPort,
    );
  });

  describe('createAccount', () => {
    it('should throw ConflictException if username already exists', async () => {
      mockRepo.findByUsername.mockResolvedValue({ id: 'acc-1' });

      await expect(
        service.createAccount({
          supplierId: '00000000-0000-0000-0000-000000000001',
          username: 'anisim_user',
          password: 'Password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create account with hashed password', async () => {
      mockRepo.findByUsername.mockResolvedValue(null);
      mockRepo.create.mockImplementation((data) =>
        Promise.resolve({ id: 'acc-1', ...data }),
      );

      const result = await service.createAccount({
        supplierId: '00000000-0000-0000-0000-000000000001',
        username: 'anisim_user',
        password: 'Password123',
      });

      expect(result.username).toBe('anisim_user');
      expect(result.passwordHash).toBeDefined();
      expect(result.passwordHash).not.toBe('Password123');
      expect(mockRepo.create).toHaveBeenCalled();
    });
  });

  describe('getByUsername', () => {
    it('should return account when found', async () => {
      mockRepo.findByUsername.mockResolvedValue({
        id: 'acc-1',
        username: 'anisim_user',
      });

      const result = await service.getByUsername('anisim_user');
      expect(result.id).toBe('acc-1');
    });

    it('should throw NotFoundException when account not found', async () => {
      mockRepo.findByUsername.mockResolvedValue(null);

      await expect(service.getByUsername('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('password verification', () => {
    it('should correctly verify hashed password', async () => {
      const password = 'SecretPassword123!';
      const hash = await SupplierAccountService.hashPassword(password);

      const isValid = await SupplierAccountService.verifyPassword(
        password,
        hash,
      );
      const isInvalid = await SupplierAccountService.verifyPassword(
        'WrongPassword',
        hash,
      );

      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });
  });
});
