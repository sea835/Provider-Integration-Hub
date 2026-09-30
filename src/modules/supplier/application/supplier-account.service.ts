import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { BaseService } from '@common/base/base.service';
import { SupplierAccountEntity } from '../domain/supplier-account.entity';
import { SupplierAccountRepositoryPort } from '../domain/supplier-account.repository.port';
import { CreateSupplierAccountDto } from '../presentation/dto/create-supplier-account.dto';
import { UpdateSupplierAccountDto } from '../presentation/dto/update-supplier-account.dto';
import * as crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);

@Injectable()
export class SupplierAccountService extends BaseService<SupplierAccountEntity> {
  constructor(
    @Inject(SupplierAccountRepositoryPort)
    private readonly supplierAccountRepository: SupplierAccountRepositoryPort,
  ) {
    super(supplierAccountRepository);
  }

  static async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  static async verifyPassword(
    password: string,
    storedHash: string,
  ): Promise<boolean> {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    const computedHash = derivedKey.toString('hex');
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(computedHash, 'hex'),
    );
  }

  async createAccount(
    dto: CreateSupplierAccountDto,
  ): Promise<SupplierAccountEntity> {
    const existing = await this.supplierAccountRepository.findByUsername(
      dto.username,
    );
    if (existing) {
      throw new ConflictException(
        `Supplier account with username [${dto.username}] already exists`,
      );
    }

    const passwordHash = await SupplierAccountService.hashPassword(
      dto.password,
    );

    return this.supplierAccountRepository.create({
      supplierId: dto.supplierId,
      username: dto.username,
      passwordHash,
      supplierToken: dto.supplierToken || null,
      email: dto.email || null,
      role: dto.role ?? 'SUPPLIER_USER',
      status: dto.status ?? 1,
      metadata: dto.metadata || null,
    });
  }

  async getByUsername(username: string): Promise<SupplierAccountEntity> {
    const account =
      await this.supplierAccountRepository.findByUsername(username);
    if (!account) {
      throw new NotFoundException(
        `Supplier account with username [${username}] not found`,
      );
    }
    return account;
  }

  async getBySupplierId(supplierId: string): Promise<SupplierAccountEntity[]> {
    return this.supplierAccountRepository.findBySupplierId(supplierId);
  }

  async updateAccount(
    id: string,
    dto: UpdateSupplierAccountDto,
  ): Promise<SupplierAccountEntity> {
    const existing = await this.supplierAccountRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Supplier account with id [${id}] not found`);
    }

    const updateData: Partial<SupplierAccountEntity> = {
      supplierId: dto.supplierId,
      username: dto.username,
      supplierToken: dto.supplierToken,
      email: dto.email,
      role: dto.role,
      status: dto.status,
      metadata: dto.metadata,
    };

    if (dto.password) {
      updateData.passwordHash = await SupplierAccountService.hashPassword(
        dto.password,
      );
    }

    const updated = await this.supplierAccountRepository.update(id, updateData);
    if (!updated) {
      throw new NotFoundException(`Failed to update supplier account [${id}]`);
    }
    return updated;
  }
}
