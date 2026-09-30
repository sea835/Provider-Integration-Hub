import { PartialType } from '@nestjs/swagger';
import { CreateSupplierSettingDto } from './create-supplier-setting.dto';

export class UpdateSupplierSettingDto extends PartialType(
  CreateSupplierSettingDto,
) {}
