import { IsOptional, IsString } from 'class-validator';

export class UpdateProjectRequest {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string | null;
}
