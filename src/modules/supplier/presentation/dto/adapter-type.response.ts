import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AdapterDescriptor } from '@modules/provider-adapter/domain/provider-adapter.port';

export class AdapterConfigFieldResponse {
  @ApiProperty({ example: 'apiKey' }) key: string;
  @ApiProperty({ example: 'API key' }) label: string;
  @ApiProperty() required: boolean;
  @ApiPropertyOptional({ enum: ['text', 'boolean'] }) type?: 'text' | 'boolean';
  @ApiPropertyOptional() help?: string;
  @ApiPropertyOptional() placeholder?: string;
}

export class AdapterTypeResponse {
  @ApiProperty({ example: 'HUB_STANDARD' }) type: string;
  @ApiProperty({ example: 'Chuẩn Hub v1' }) label: string;
  @ApiProperty() description: string;
  @ApiProperty({ type: [String] }) actions: string[];
  @ApiProperty() callback: boolean;
  @ApiProperty({ type: [AdapterConfigFieldResponse] })
  params: AdapterConfigFieldResponse[];
  @ApiProperty({ type: [AdapterConfigFieldResponse] })
  secrets: AdapterConfigFieldResponse[];

  static from(descriptor: AdapterDescriptor): AdapterTypeResponse {
    return Object.assign(new AdapterTypeResponse(), descriptor);
  }
}
