import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProjectRequest {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}
