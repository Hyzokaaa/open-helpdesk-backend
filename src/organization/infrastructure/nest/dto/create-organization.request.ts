import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOrganizationRequest {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  domains?: string[];
}
