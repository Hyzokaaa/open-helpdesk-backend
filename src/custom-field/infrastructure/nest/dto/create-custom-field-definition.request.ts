import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CustomFieldType } from '../../../domain/enums/custom-field-type.enum';

export class CreateCustomFieldDefinitionRequest {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(CustomFieldType)
  type!: CustomFieldType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  options?: string[];

  @IsBoolean()
  @IsOptional()
  required?: boolean;
}
