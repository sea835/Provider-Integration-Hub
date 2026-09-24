import { NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { UserEntity } from '../domain/user.entity';
import { UserRepository } from '../infrastructure/user.repository';
import { LoggerPort } from '@common/logger';

describe('UserService', () => {
  let service: UserService;
  let mockRepository: {
    create: jest.Mock;
    findById: jest.Mock;
    findAll: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let mockLogger: Record<string, jest.Mock>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockLogger = {
      child: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    service = new UserService(
      mockRepository as unknown as UserRepository,
      mockLogger as unknown as LoggerPort,
    );
  });

  describe('Password hashing & verification', () => {
    it('nên băm mật khẩu và verify chính xác', () => {
      const password = 'mySecretPassword123';
      const hash = UserService.hashPassword(password);

      expect(hash).toContain(':');
      expect(UserService.verifyPassword(password, hash)).toBe(true);
      expect(UserService.verifyPassword('wrongPassword', hash)).toBe(false);
    });
  });

  describe('create', () => {
    it('nên băm mật khẩu trước khi lưu vào repository', async () => {
      const input = { email: 'test@example.com', password: 'plainPassword' };
      const createdUser: UserEntity = {
        id: 'user-1',
        email: input.email,
        password: 'hashed-password',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockResolvedValue(createdUser);

      const result = await service.create(input);

      expect(mockRepository.create).toHaveBeenCalled();
      const firstCall = mockRepository.create.mock.calls[0] as [
        Partial<UserEntity>,
      ];
      const calledArg = firstCall[0];
      expect(calledArg.email).toBe('test@example.com');
      expect(calledArg.password).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
      expect(result).toEqual(createdUser);
    });
  });

  describe('findOne', () => {
    it('nên trả về user nếu tìm thấy', async () => {
      const user: UserEntity = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hash',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(user);

      const result = await service.findOne('user-1');
      expect(result).toEqual(user);
    });

    it('nên ném NotFoundException nếu không tìm thấy', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('nên ném NotFoundException nếu record không tồn tại khi update', async () => {
      mockRepository.update.mockResolvedValue(null);

      await expect(
        service.update('invalid-id', { email: 'new@example.com' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('nên ném NotFoundException nếu record không tồn tại khi delete', async () => {
      mockRepository.delete.mockResolvedValue(false);

      await expect(service.remove('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('nên xóa thành công nếu record tồn tại', async () => {
      mockRepository.delete.mockResolvedValue(true);

      const result = await service.remove('user-1');
      expect(result).toBe(true);
    });
  });
});
