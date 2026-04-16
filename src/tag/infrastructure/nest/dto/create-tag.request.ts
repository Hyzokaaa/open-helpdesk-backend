import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTagRequest {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  color?: string;
}
