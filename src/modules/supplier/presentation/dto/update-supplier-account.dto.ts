import { PartialType } from '@nestjs/swagger';
import { CreateSupplierAccountDto } from './create-supplier-account.dto';

export class UpdateSupplierAccountDto extends PartialType(
  CreateSupplierAccountDto,
) {}
