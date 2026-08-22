import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateOrganizationRequest {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsString()
  @IsOptional()
  notes?: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  domains?: string[];
}
