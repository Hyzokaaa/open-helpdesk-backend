import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateCustomFieldDefinitionRequest {
  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  options?: string[];

  @IsBoolean()
  @IsOptional()
  required?: boolean;
}
