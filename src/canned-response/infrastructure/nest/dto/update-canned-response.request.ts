import { IsOptional, IsString } from 'class-validator';

export class UpdateCannedResponseRequest {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;
}
