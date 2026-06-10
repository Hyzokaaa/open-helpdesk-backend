import { IsNotEmpty, IsString, IsOptional, IsArray, IsEnum, IsDateString } from 'class-validator';
import { ApiKeyScope } from '../../../domain/enums/api-key-scope.enum';

export class CreateApiKeyRequest {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ApiKeyScope, { each: true })
  scopes?: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
