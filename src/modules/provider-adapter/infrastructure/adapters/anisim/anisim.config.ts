import { IsNotEmpty, IsString } from 'class-validator';

export class AnisimParams {}

export class AnisimSecrets {
  @IsString()
  @IsNotEmpty()
  apiKey: string;
}
