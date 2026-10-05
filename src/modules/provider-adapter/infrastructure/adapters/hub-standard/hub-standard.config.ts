import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class HubStandardParams {
  @IsString()
  @IsNotEmpty()
  keyId: string;

  /** Giao diện lưu dạng chuỗi "true"/"false". */
  @IsOptional()
  @IsIn([true, false, 'true', 'false', ''])
  checkBeforeSubmit?: boolean | string;
}

export class HubStandardSecrets {
  @IsString()
  @IsNotEmpty()
  secret: string;

  @IsOptional()
  @IsString()
  callbackSecret?: string;
}
