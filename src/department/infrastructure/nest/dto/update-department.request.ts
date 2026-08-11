import { IsOptional, IsString } from 'class-validator';

export class UpdateDepartmentRequest {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string | null;
}
