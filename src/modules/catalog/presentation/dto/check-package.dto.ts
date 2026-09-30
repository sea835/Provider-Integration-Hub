import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CheckPackageEligibilityDto {
  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsString()
  packageCode: string;

  @IsOptional()
  @IsString()
  action?: string;
}
