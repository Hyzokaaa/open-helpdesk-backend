import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDepartmentRequest {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}
